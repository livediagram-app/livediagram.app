import type { Page } from '@playwright/test';
import { auditContrast } from '@liveworkspace/e2e-kit/contrast';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { WEBBER } from './agent-session';
import { freshUserId, installSession } from './session';

// The MCP consent screen (docs/specs/015-api/mcp-server.md "What the consent screen may believe", "Consent + mint"):
// a tool on the person's own computer gets its sign-in back on a loopback port, so the screen says this computer
// rather than naming a site; a reconnect replaces the token that client held; and at the token cap the screen lists
// the account's tokens to revoke one, then connects. The stack runs no MCP worker and no account API, so their
// routes are answered here as they would answer; the token itself is minted through the api, as in production.

const MCP = 'https://mcp.livediagram.app';
const ACCOUNT_TOKENS = '**/api/workspace/account/tokens**';
const DAY = 86_400_000;
const NOW = Date.now();

const LOOPBACK = {
  clientName: 'Claude Code',
  redirectHost: 'localhost:55884',
  clientId: 'c0ffee',
  verified: false,
};

// Twenty live tokens, as an account at the cap holds them (MAX_API_TOKENS_PER_ACCOUNT).
const NAMES = [
  'Claude Code',
  'Cursor',
  'Weekly report script',
  'Claude',
  'livediagram CLI',
  'ChatGPT',
  'Zed',
  'Raycast',
  'Release notes bot',
  'Windsurf',
];
const AT_CAP = Array.from({ length: 20 }, (_, i) => ({
  id: `tok_${i}`,
  name: `${NAMES[i % NAMES.length]}${i >= NAMES.length ? ' (laptop)' : ''}`,
  readOnly: i % 6 === 2,
  createdAt: NOW - (120 - i * 4) * DAY,
  lastUsedAt: i % 7 === 3 ? null : NOW - (60 - i * 3) * DAY,
  expiresAt: NOW + (60 + i * 4) * DAY,
}));

async function signedIn(page: Page, scheme: 'dark' | 'light'): Promise<void> {
  await installSession(page, { ...WEBBER, id: freshUserId('webber') });
  await page.addInitScript((mode) => localStorage.setItem('livediagram:v2:ui-mode', mode), scheme);
}

async function shoot(page: Page, name: string): Promise<void> {
  const dir = process.env.CONSENT_SHOT_DIR;
  await page.screenshot({
    path: dir ? `${dir}/${name}.png` : test.info().outputPath(`${name}.png`),
    fullPage: true,
  });
}

const VIEWS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
} as const;

for (const [view, use] of Object.entries(VIEWS)) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`consent, ${view}, ${scheme}`, () => {
      test.use({ ...use, colorScheme: scheme, reducedMotion: 'reduce' });

      test('a loopback client reads as this computer', async ({ page, pageErrors }) => {
        await signedIn(page, scheme);
        await page.route(`${MCP}/oauth/session/*`, (route) => route.fulfill({ json: LOOPBACK }));
        // The address's own client and host are never what the screen says.
        await page.goto('/oauth/consent?session=s1&client=Notion&to=notion.so');
        await expect(page.getByRole('heading', { name: 'Connect Claude Code' })).toBeVisible();
        const note = page.getByRole('note');
        await expect(note).toContainText(
          'Claude Code is not made by liveworkspace, and we can’t check who made it.',
        );
        await expect(note).toContainText(
          'Access will be sent back to the app on this computer (localhost:55884). Only continue if you started this connection yourself.',
        );
        await expect(note).not.toContainText('notion.so');
        await shoot(page, `consent-loopback-${view}-${scheme}`);
        const report = await auditContrast(page);
        expect(report.failures).toEqual([]);
        expectNoPageErrors(pageErrors);
      });

      test('at the token cap, revoke one and connect', async ({ page, pageErrors }) => {
        await signedIn(page, scheme);
        let live = [...AT_CAP];
        let full = true;
        const revoked: string[] = [];
        await page.route(`${MCP}/oauth/session/*`, (route) => route.fulfill({ json: LOOPBACK }));
        await page.route('**/api/oauth/exchange', async (route) =>
          full
            ? route.fulfill({ status: 409, json: { error: 'token_limit_reached' } })
            : route.fallback(),
        );
        await page.route(ACCOUNT_TOKENS, async (route) => {
          const request = route.request();
          if (request.method() === 'DELETE') {
            const id = request.url().split('/').pop()!;
            revoked.push(id);
            live = live.filter((t) => t.id !== id);
            full = false;
            return route.fulfill({ json: { id } });
          }
          return route.fulfill({ json: { tokens: live } });
        });
        await page.route(`${MCP}/oauth/complete`, (route) =>
          route.fulfill({
            json: { redirectTo: 'http://localhost:55884/callback?code=x', replaces: [] },
          }),
        );
        await page.route('http://localhost:55884/**', (route) =>
          route.fulfill({ contentType: 'text/html', body: '<p>Signed in</p>' }),
        );

        await page.goto('/oauth/consent?session=s1');
        await page.getByRole('button', { name: 'Connect', exact: true }).click();
        await expect(page.getByRole('alert').first()).toHaveText(
          'Your account has reached its limit of 20 API tokens. Revoke one below, then connect.',
        );
        const list = page.getByRole('region', { name: 'Your API Tokens' }).getByRole('listitem');
        await expect(list).toHaveCount(20);
        await shoot(page, `consent-limit-${view}-${scheme}`);
        expect((await auditContrast(page)).failures).toEqual([]);

        // Least recently used first: a never-used token by when it was made.
        const first = list.first();
        await first.getByRole('button', { name: 'Revoke' }).click();
        await shoot(page, `consent-limit-confirm-${view}-${scheme}`);
        await first.getByRole('button', { name: 'Revoke now' }).click();
        await expect(page.getByRole('status')).toHaveText('There’s room for one more token now.');
        await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeFocused();
        await expect(list).toHaveCount(19);
        expect(revoked).toEqual(['tok_3']);
        await shoot(page, `consent-limit-freed-${view}-${scheme}`);

        await page.getByRole('button', { name: 'Connect', exact: true }).click();
        await page.waitForURL('http://localhost:55884/callback?code=x');
        expectNoPageErrors(pageErrors);
      });
    });
  }
}

test.describe('consent, a reconnect', () => {
  test.use({ ...VIEWS.desktop, colorScheme: 'light', reducedMotion: 'reduce' });

  test('revokes the token this client held, once the new one is handed over', async ({ page }) => {
    await signedIn(page, 'light');
    const handed: { tokenId: string }[] = [];
    const revoked: string[] = [];
    await page.route(`${MCP}/oauth/session/*`, (route) => route.fulfill({ json: LOOPBACK }));
    await page.route(`${MCP}/oauth/complete`, async (route) => {
      handed.push(route.request().postDataJSON() as { tokenId: string });
      await route.fulfill({
        json: { redirectTo: 'http://localhost:55884/callback?code=x', replaces: ['old', 'manual'] },
      });
    });
    await page.route(ACCOUNT_TOKENS, async (route) => {
      const request = route.request();
      if (request.method() === 'DELETE') {
        revoked.push(request.url().split('/').pop()!);
        return route.fulfill({ json: {} });
      }
      const at = (id: string, name: string) => ({ ...AT_CAP[0]!, id, name });
      return route.fulfill({
        json: {
          tokens: [
            at(handed[0]!.tokenId, 'Claude Code'),
            at('old', 'Claude Code'),
            at('manual', 'Weekly report script'),
            at('other', 'Claude Code'),
          ],
        },
      });
    });
    await page.route('http://localhost:55884/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<p>Signed in</p>' }),
    );
    await page.goto('/oauth/consent?session=s1');
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await page.waitForURL('http://localhost:55884/callback?code=x');
    expect(handed).toEqual([
      expect.objectContaining({
        session: 's1',
        tokenId: expect.any(String),
        token: expect.stringMatching(/^lwt_/),
      }),
    ]);
    expect(revoked).toEqual(['old']);
  });
});
