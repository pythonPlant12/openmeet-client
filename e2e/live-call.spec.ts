import { type APIRequestContext, type Browser, type BrowserContext, type Page, expect, test } from '@playwright/test';
import process from 'node:process';

// The SFU/API the dev stack exposes; the e2e run points PLAYWRIGHT_BASE_URL at the matching frontend.
const apiBaseUrl = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:8081';

interface Account {
  id: string;
  accessToken: string;
  refreshToken: string;
  name: string;
}

test.use({
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  },
});

test.describe('live call', () => {
  test('pressing call on a group with a live call joins it', async ({ browser, request, baseURL }) => {
    test.setTimeout(180_000);
    const unique = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const alice = await registerAccount(request, `alice_${unique}`, 'Alice Live');
    const bob = await registerAccount(request, `bob_${unique}`, 'Bob Live');
    await makeFriends(request, alice, bob);
    const group = await createGroup(request, alice, [bob.id], `Live call ${unique}`);
    // A direct chat is listed once it has a message.
    const opened = (await (await social(request, bob, 'post', `/conversations/direct/${alice.id}`)).json()) as {
      conversation: { id: string };
    };
    await social(request, bob, 'post', `/conversations/${opened.conversation.id}/messages`, { content: 'hi' });

    const contexts: BrowserContext[] = [];
    try {
      const alicePage = await openDashboardAs(browser, baseURL!, alice, contexts);
      const bobPage = await openDashboardAs(browser, baseURL!, bob, contexts);

      // Alice starts the group call from the chat header and enters the room.
      await openConversation(alicePage, group.title);
      await alicePage.getByRole('button', { name: 'Start a group audio call' }).click();
      await expect(alicePage).toHaveURL(/\/room\//, { timeout: 15_000 });
      await expect(alicePage.getByTestId('participant-tile')).toHaveCount(1, { timeout: 20_000 });
      const aliceRoomUrl = new URL(alicePage.url());

      // Bob's list rings the group's picture while Alice is in the call, without a reload.
      const bobGroupRow = bobPage
        .getByRole('navigation', { name: 'Persistent conversations' })
        .locator('[data-conversation-row]', { hasText: group.title })
        .first();
      await expect(bobGroupRow.locator('[data-conversation-avatar]')).toHaveClass(/harbor-live-call-ring/, {
        timeout: 15_000,
      });

      // Bob's header offers Join instead of the call buttons: he joins Alice's live call, with no error.
      await openConversation(bobPage, group.title);
      await expect(bobPage.locator('header [data-conversation-avatar]')).toHaveClass(/harbor-live-call-ring/);
      await expect(bobPage.getByRole('button', { name: 'Start a group audio call' })).toHaveCount(0);
      await bobPage.getByRole('button', { name: 'Join call' }).click();
      await expect(bobPage).toHaveURL(/\/room\//, { timeout: 15_000 });
      expect(new URL(bobPage.url()).pathname).toBe(aliceRoomUrl.pathname);
      await expect(bobPage.getByText('Could not start call.')).toHaveCount(0);

      // Both are in one room: each sees the other's tile.
      await expect(alicePage.getByTestId('participant-tile')).toHaveCount(2, { timeout: 20_000 });
      await expect(bobPage.getByTestId('participant-tile')).toHaveCount(2, { timeout: 20_000 });

      // Bob collapses the call: the dashboard shows the mini call with Alice, and Alice never sees him leave.
      await bobPage.mouse.move(20, 20);
      await bobPage.locator('[data-collapse-trigger]').click();
      await expect(bobPage).toHaveURL(/\/dashboard/);
      const miniCall = bobPage.locator('[data-mini-call]');
      await expect(miniCall).toBeVisible();
      await expect(miniCall.getByTestId('participant-tile')).toHaveCount(1);
      await expect(miniCall).toContainText('Alice Live');
      await expect(alicePage.getByTestId('participant-tile')).toHaveCount(2);

      // Hovering the mini call reveals its controls; expanding returns to the call screen with everyone still
      // there, and the mini call goes away.
      await miniCall.hover();
      await bobPage.locator('[data-mini-call-expand]').click();
      await expect(bobPage).toHaveURL(new RegExp(aliceRoomUrl.pathname));
      await expect(bobPage.getByTestId('participant-tile')).toHaveCount(2);
      await expect(miniCall).toHaveCount(0);

      // Browser Back collapses rather than ending the call.
      await bobPage.goBack();
      await expect(bobPage).toHaveURL(/\/dashboard/);
      await expect(miniCall).toBeVisible();
      await expect(alicePage.getByTestId('participant-tile')).toHaveCount(2);

      // The group's chat header offers Return to call for the active call, and its picture opens a menu.
      await openConversation(bobPage, group.title);
      await bobPage.locator('header [data-conversation-picture]').click();
      await expect(bobPage.getByRole('menuitem', { name: 'Group info' })).toBeVisible();
      await expect(bobPage.getByRole('menuitem', { name: 'Return to call' })).toBeVisible();
      await bobPage.keyboard.press('Escape');
      await bobPage.locator('header').getByRole('button', { name: 'Return to call' }).click();
      await expect(bobPage).toHaveURL(new RegExp(aliceRoomUrl.pathname));
      await expect(bobPage.getByTestId('participant-tile')).toHaveCount(2);
      await expect(miniCall).toHaveCount(0);

      // Starting a different call asks first. Cancel keeps the group call; Leave and join ends it and joins.
      await bobPage.goBack();
      await expect(miniCall).toBeVisible();
      await openConversation(bobPage, 'Alice Live');
      await bobPage.getByRole('button', { name: 'Start an audio call' }).click();
      const prompt = bobPage.getByRole('dialog').filter({ hasText: 'Leave current call?' });
      await expect(prompt).toBeVisible();
      await prompt.getByRole('button', { name: 'Cancel' }).click();
      await expect(prompt).toHaveCount(0);
      await expect(miniCall).toBeVisible();
      await expect(alicePage.getByTestId('participant-tile')).toHaveCount(2);

      await bobPage.getByRole('button', { name: 'Start an audio call' }).click();
      await prompt.getByRole('button', { name: 'Leave and join' }).click();
      await expect(bobPage).toHaveURL(/\/room\//, { timeout: 15_000 });
      expect(new URL(bobPage.url()).pathname).not.toBe(aliceRoomUrl.pathname);
      await expect(bobPage.getByTestId('participant-tile')).toHaveCount(1, { timeout: 20_000 });
      await expect(alicePage.getByTestId('participant-tile')).toHaveCount(1, { timeout: 20_000 });
    } finally {
      await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
    }
  });
});

async function registerAccount(request: APIRequestContext, nickname: string, name: string): Promise<Account> {
  const response = await request.post(`${apiBaseUrl}/auth/register`, {
    data: { email: `${nickname}@example.com`, name, nickname, password: 'live-call-password' },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = (await response.json()) as {
    user: { id: string };
    access_token: string;
    refresh_token: string;
  };
  return { id: body.user.id, accessToken: body.access_token, refreshToken: body.refresh_token, name };
}

async function social(request: APIRequestContext, account: Account, method: 'get' | 'post', path: string, data?: unknown) {
  const response = await request[method](`${apiBaseUrl}/social${path}`, {
    headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
    data,
  });
  expect(response.ok(), `${method.toUpperCase()} ${path}: ${await response.text()}`).toBeTruthy();
  return response;
}

async function makeFriends(request: APIRequestContext, requester: Account, addressee: Account) {
  await social(request, requester, 'post', '/friends', { userId: addressee.id });
  const friends = (await (await social(request, addressee, 'get', '/friends')).json()) as {
    incomingRequests: { id: string }[];
  };
  const incoming = friends.incomingRequests[0];
  expect(incoming).toBeTruthy();
  await social(request, addressee, 'post', `/friends/${incoming.id}/accept`);
}

async function createGroup(request: APIRequestContext, creator: Account, memberIds: string[], title: string) {
  const response = await social(request, creator, 'post', '/conversations/groups', {
    title,
    accessPolicy: 'open',
    memberIds,
  });
  return (await response.json()) as { id: string; title: string };
}

async function openDashboardAs(browser: Browser, baseURL: string, account: Account, contexts: BrowserContext[]) {
  const context = await browser.newContext();
  contexts.push(context);
  const origin = new URL(baseURL);
  await context.addCookies([
    { name: 'accessToken', value: account.accessToken, domain: origin.hostname, path: '/' },
    { name: 'refreshToken', value: account.refreshToken, domain: origin.hostname, path: '/' },
  ]);
  const page = await context.newPage();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard/);
  return page;
}

async function openConversation(page: Page, title: string) {
  const rows = page.getByRole('navigation', { name: 'Persistent conversations' });
  await rows.locator('[data-conversation-row]', { hasText: title }).first().click();
  await expect(page.locator('#conversation-title')).toHaveText(title, { timeout: 10_000 });
}
