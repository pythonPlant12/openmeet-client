import { expect, test } from '@playwright/test';

test.use({
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  },
});

test.describe('action menus', () => {
  test('the workspace keeps native menus on text inputs', async ({ page }) => {
    const unique = Date.now();
    await page.goto('/register');
    await page.getByLabel('Your name').fill('Menu Tester');
    await page.getByLabel('Nickname').fill(`menu_${unique}`);
    await page.getByLabel('Email address').fill(`menu-${unique}@example.com`);
    await page.getByLabel('Password', { exact: true }).fill('menu-password');
    await page.getByLabel('Confirm password').fill('menu-password');
    await page.getByRole('button', { name: 'Create an account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // A right-click or a long-press on a text input keeps the browser's own menu, not an app menu.
    const search = page.getByRole('searchbox', { name: 'Search chats' });
    await search.click({ button: 'right' });
    await expect(page.getByRole('menu')).toHaveCount(0);

    await search.dispatchEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'touch' });
    await search.evaluate(() => new Promise((resolve) => window.setTimeout(resolve, 800)));
    await search.dispatchEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'touch' });
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('meeting ⋮ menu holds the rarer actions next to the bar, and the tile area opens the layout menu', async ({
    page,
  }) => {
    // A guest without a saved name is asked only for the name; the call starts with the microphone off.
    await page.goto(`/room/action-menu-${Date.now()}`);
    await expect(page.getByRole('heading', { name: 'Join Meeting' })).toBeVisible();
    await page.getByLabel('Your Name').fill('Action Tester');
    await page.getByRole('button', { name: 'Join Meeting' }).click();
    await expect(page.getByTestId('participant-tile')).toHaveCount(1, { timeout: 20_000 });

    // Mic, camera and chat live in the bar; the ⋮ menu holds the rarer actions.
    await page.locator('[data-media-control="audio"] [data-media-toggle]').click();
    await expect(page.getByRole('button', { name: 'Mute microphone' })).toBeVisible();
    await page.locator('[data-chat-trigger]').click();
    await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Open meeting actions' }).click();
    for (const name of ['Invite', 'Participants (1)', 'Developer tools', 'Report a bug']) {
      await expect(page.getByRole('menu').getByText(name, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('menuitem', { name: 'Open chat' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Open meeting actions' }).click();
    await page.getByRole('menuitemradio', { name: 'Speaker view' }).click();
    await expect(page.getByTestId('meeting-video-canvas')).toHaveAttribute('data-view-mode', 'speaker');

    // The tile area's context menu is the layout menu: Grid and Speaker only.
    await page.getByTestId('meeting-video-canvas').click({ button: 'right', position: { x: 20, y: 20 } });
    await expect(page.getByRole('menuitemradio', { name: 'Grid view' })).toBeVisible();
    await expect(page.getByRole('menuitemradio', { name: 'Speaker view' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('menuitem', { name: 'Report a bug' })).toHaveCount(0);
    await page.getByRole('menuitemradio', { name: 'Grid view' }).click();
    await expect(page.getByTestId('meeting-video-canvas')).toHaveAttribute('data-view-mode', 'grid');

    await page.getByRole('button', { name: 'Open meeting actions' }).click();
    const reportHref = await page.getByRole('menuitem', { name: 'Report a bug' }).getAttribute('href');
    await page.keyboard.press('Escape');
    expect(reportHref).toContain('Area%3A+meeting');
    expect(reportHref).not.toContain('action-menu-');

    const participantTile = page.getByTestId('participant-tile').last();
    await participantTile.dispatchEvent('pointerdown', {
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    await participantTile.evaluate(() => new Promise((resolve) => window.setTimeout(resolve, 800)));
    await participantTile.dispatchEvent('pointerup', {
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    await expect(page.getByRole('menuitemradio', { name: 'Speaker view' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('meeting-video-canvas').focus();
    await page.keyboard.press('ContextMenu');
    await expect(page.getByRole('menuitemradio', { name: 'Grid view' })).toBeVisible();
  });
});
