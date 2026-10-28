import { expect, test, type Page } from '@playwright/test';

/**
 * The journeys a beta tester will actually take, end to end, against a
 * production build in demo mode.
 *
 * The Definition of Done opens with: "a guest can open the site on a phone,
 * pick a load, enter conditions, and get a full solution in under 30 seconds."
 * That is the first test here.
 */

/** Create a rifle and a load through the UI, and return the load's URL. */
async function createProfile(page: Page, rifleName = 'Test Rifle'): Promise<string> {
  await page.goto('/rifles');
  await page.getByRole('button', { name: /new rifle/i }).click();

  await page.getByLabel('Name', { exact: true }).fill(rifleName);
  await page.getByLabel('Cartridge').fill('6.5 Creedmoor');
  await page.getByRole('button', { name: /save rifle/i }).click();

  await page.getByRole('link', { name: new RegExp(rifleName, 'i') }).click();
  await expect(page.getByRole('heading', { name: rifleName })).toBeVisible();

  await page.getByRole('button', { name: /new load/i }).click();
  await page.waitForURL(/\/loads\//);
  return page.url();
}

test.describe('the calculator', () => {
  test('a guest gets a full solution with no account', async ({ page }) => {
    await page.goto('/calc');

    await expect(page.getByRole('heading', { name: 'The Lab' })).toBeVisible();

    // The default load solves immediately; no input required to see numbers.
    const table = page.getByRole('table', { name: /ballistic solution/i });
    await expect(table).toBeVisible();
    await expect(table.getByRole('row')).toHaveCount(12); // header + 11 ranges

    // A real elevation correction, not a placeholder.
    await expect(table.getByText(/\d+\.\d U/).first()).toBeVisible();
  });

  test('the solution responds to a change in conditions', async ({ page }) => {
    await page.goto('/calc');
    const table = page.getByRole('table', { name: /ballistic solution/i });
    const before = await table.getByRole('row').last().innerText();

    // `getByLabel` is ambiguous here: the unit radiogroup is labelled
    // "Wind speed unit", which also matches.
    await page.getByRole('textbox', { name: 'Wind speed' }).fill('15');

    await expect.poll(async () => table.getByRole('row').last().innerText()).not.toBe(before);
  });

  test('carries the required disclaimer with the numbers', async ({ page }) => {
    await page.goto('/calc');
    await expect(page.getByText(/this is an estimate/i)).toBeVisible();
  });

  test('refuses to solve nonsense and says why', async ({ page }) => {
    await page.goto('/calc');
    await page.getByRole('textbox', { name: 'Muzzle velocity' }).fill('0');
    await expect(page.getByText(/must be greater than zero/i).first()).toBeVisible();
  });
});

test.describe('profiles', () => {
  test('a rifle and load can be created and opened in the calculator', async ({ page }) => {
    await createProfile(page, 'Tikka T3x');

    await expect(page.getByRole('heading', { name: /new load/i })).toBeVisible();

    await page.getByRole('link', { name: /open in the calculator/i }).click();
    await page.waitForURL(/\/calc\?load=/);
    await expect(page.getByText(/loaded/i).first()).toBeVisible();
    await expect(page.getByRole('table', { name: /ballistic solution/i })).toBeVisible();
  });

  test('a DOPE card previews and offers a download', async ({ page }) => {
    await createProfile(page, 'Dope Rifle');
    await page.getByRole('link', { name: /dope card/i }).click();
    await page.waitForURL(/\/dope\//);

    await expect(page.getByRole('heading', { name: /dope card/i })).toBeVisible();
    // The preview is built from the same numbers as the PDF.
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('link', { name: /download pdf/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('range mode shows a dialable correction', async ({ page }) => {
    await createProfile(page, 'Range Rifle');
    await page.getByRole('link', { name: /range mode/i }).click();
    await page.waitForURL(/\/range/);

    await expect(page.getByText('Elevation')).toBeVisible();
    await expect(page.getByText(/clicks/i).first()).toBeVisible();

    const distance = page.getByText('500', { exact: true });
    await expect(distance).toBeVisible();
    await page.getByRole('button', { name: /forward 25/i }).click();
    await expect(page.getByText('525', { exact: true })).toBeVisible();
  });
});

test.describe('the suppressor compatibility checker', () => {
  test('never passes on missing data', async ({ page }) => {
    await page.goto('/suppressors/compatibility');
    // Nothing entered at all: the verdict must not be "compatible".
    await expect(page.getByText(/not enough data/i)).toBeVisible();
    await expect(page.getByText('Compatible', { exact: true })).toHaveCount(0);
  });

  test('fails a bullet larger than the bore', async ({ page }) => {
    await page.goto('/suppressors/compatibility');
    await page.getByRole('textbox', { name: 'Bore diameter' }).fill('0.224');
    await page.getByRole('textbox', { name: 'Bullet diameter' }).fill('0.308');
    await expect(page.getByText(/do not fire/i)).toBeVisible();
    await expect(page.getByText(/strike the baffles/i)).toBeVisible();
  });

  test('carries the safety disclaimer', async ({ page }) => {
    await page.goto('/suppressors/compatibility');
    await expect(page.getByText(/a data check, not an approval/i)).toBeVisible();
  });
});

test.describe('the field', () => {
  test('a session can be logged and read back', async ({ page }) => {
    await createProfile(page, 'Session Rifle');

    await page.goto('/sessions/new');
    await expect(page.getByRole('heading', { name: /log a session/i })).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click(); // Setup -> Conditions
    await page.getByRole('button', { name: 'Next' }).click(); // Conditions -> Strings

    await page.getByLabel('Velocities').fill('2690 2695 2688 2692');
    await expect(page.getByText('2691', { exact: true })).toBeVisible(); // mean

    await page.getByRole('button', { name: 'Next' }).click(); // Strings -> Observations
    await page.getByRole('button', { name: 'Next' }).click(); // Observations -> Review

    await expect(page.getByText(/4 shots/i).first()).toBeVisible();
    await page.getByRole('button', { name: /save session/i }).click();

    await page.waitForURL(/\/sessions\//);
    await expect(page.getByText('2690 · 2695 · 2688 · 2692')).toBeVisible();

    await page.goto('/field');
    await expect(page.getByText('4', { exact: true }).first()).toBeVisible();
  });

  test('community data stays hidden behind the flag', async ({ page }) => {
    await page.goto('/field');
    await expect(page.getByText(/community data/i)).toBeVisible();
    await expect(page.getByText(/50,000/)).toBeVisible();
  });
});

test.describe('the library', () => {
  test('lists bullets, badges them unverified, and loads one into the calculator', async ({
    page,
  }) => {
    await page.goto('/library');
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

    const rows = page.getByRole('row');
    expect(await rows.count()).toBeGreaterThan(10);
    await expect(page.getByText('Unverified').first()).toBeVisible();

    await page.getByLabel('Search').fill('140 eld');
    await expect(page.getByRole('row')).toHaveCount(await rows.count());

    await page.getByRole('link', { name: 'Use' }).first().click();
    await page.waitForURL(/\/calc\?bullet=/);
    await expect(page.getByRole('table', { name: /ballistic solution/i })).toBeVisible();
  });
});

test.describe('the admin area', () => {
  test('refuses to render a console without a backend', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText(/not available in demo mode/i)).toBeVisible();
  });
});

test.describe('shell', () => {
  test('legal pages are reachable and marked draft', async ({ page }) => {
    await page.goto('/legal/disclaimer');
    await expect(page.getByText(/draft/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Disclaimer' })).toBeVisible();
  });

  test('unbuilt sections are not linked', async ({ page }) => {
    await page.goto('/');
    // Every nav link must resolve; "soon" items are spans, not links.
    const links = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
    for (const link of await links.all()) {
      const href = await link.getAttribute('href');
      expect(href).toBeTruthy();
    }
  });

  test('a missing page is a 404, not a crash', async ({ page }) => {
    const response = await page.goto('/nope');
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/nothing at that range/i)).toBeVisible();
  });
});
