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
  test.skip(({ browserName }) => browserName !== 'chromium', 'fake media interactions are verified in Chromium');

  test('dashboard exposes equivalent ellipsis and context actions without replacing native input menus', async ({
    page,
  }) => {
    const unique = Date.now();
    await page.goto('/register');
    await page.getByLabel('Your name').fill('Menu Tester');
    await page.getByLabel('Email address').fill(`menu-${unique}@example.com`);
    await page.getByLabel('Password', { exact: true }).fill('menu-password');
    await page.getByLabel('Confirm password').fill('menu-password');
    await page.getByRole('button', { name: 'Create an account' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('button', { name: 'Open dashboard actions' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByText('Start a meeting')).toBeVisible();
    await expect(menu.getByText('Report a bug')).toBeVisible();
    const reportHref = await menu.getByRole('menuitem', { name: 'Report a bug' }).getAttribute('href');
    expect(reportHref).toContain('github.com/pythonPlant12/openmeet/issues/new');
    expect(reportHref).not.toContain('/room/');
    await page.keyboard.press('Escape');

    await page.getByPlaceholder('friend@example.com').click({ button: 'right' });
    await expect(page.getByRole('menu')).toHaveCount(0);

    const friendInput = page.getByPlaceholder('friend@example.com');
    await friendInput.dispatchEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'touch' });
    await page.waitForTimeout(800);
    await friendInput.dispatchEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'touch' });
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.getByRole('heading', { name: /Ready when you are/ }).click({ button: 'right' });
    await expect(page.getByRole('menu').getByText('Start a meeting')).toBeVisible();
    await expect(page.getByRole('menu').getByText('Report a bug')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.locator('header[aria-label="Dashboard action surface"]').focus();
    await page.keyboard.press('ContextMenu');
    await expect(page.getByRole('menu').getByText('Start a meeting')).toBeVisible();
  });

  test('meeting menu stays synchronized with media, chat, layout, and context actions', async ({ page }) => {
    await page.goto(`/room/action-menu-${Date.now()}`);
    await expect(page.getByRole('heading', { name: 'Join Meeting' })).toBeVisible();
    await page.getByLabel('Your Name').fill('Action Tester');
    await page.getByRole('button', { name: 'Join Meeting' }).click();
    await expect(page.getByTestId('participant-tile')).toHaveCount(1, { timeout: 20_000 });

    await page.getByRole('button', { name: 'Open meeting actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Open chat' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Mute microphone' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Mute microphone' }).click();
    await expect(page.getByRole('button', { name: 'Unmute microphone' })).toBeVisible();

    await page.getByRole('button', { name: 'Open meeting actions' }).click();
    await page.getByRole('menuitem', { name: 'Open chat' }).click();
    await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible();

    await page.getByRole('button', { name: 'Open meeting actions' }).click();
    await page.getByRole('menuitemradio', { name: 'Speaker view' }).click();
    await expect(page.getByTestId('meeting-video-canvas')).toHaveAttribute('data-view-mode', 'speaker');

    await page.getByTestId('meeting-video-canvas').click({ button: 'right', position: { x: 20, y: 20 } });
    await expect(page.getByRole('menuitem', { name: 'Close chat' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Unmute microphone' })).toBeVisible();
    const reportHref = await page.getByRole('menuitem', { name: 'Report a bug' }).getAttribute('href');
    expect(reportHref).toContain('Area%3A+meeting');
    expect(reportHref).not.toContain('action-menu-');
    await page.keyboard.press('Escape');

    const participantTile = page.getByTestId('participant-tile').last();
    await participantTile.dispatchEvent('pointerdown', {
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    await page.waitForTimeout(800);
    await participantTile.dispatchEvent('pointerup', {
      bubbles: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    await expect(page.getByRole('menuitem', { name: 'Close chat' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('meeting-video-canvas').focus();
    await page.keyboard.press('ContextMenu');
    await expect(page.getByRole('menuitem', { name: 'Close chat' })).toBeVisible();
  });
});
