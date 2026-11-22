// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withAccountHost } from '../../test/account-host';
import { TokenList } from './TokenList';

// The token rows Settings › API Tokens and the OAuth pages at the token cap share
// (liveworkspace/docs/specs/003-accounts/accounts.md "API tokens"): cards in Settings, one bordered list when
// `compact`, and Revoke asking first in both.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAY = 86_400_000;
const USED = {
  id: 'used',
  name: 'Claude Code',
  readOnly: true,
  createdAt: 1_790_000_000_000,
  lastUsedAt: 1_790_000_000_000 + 3 * DAY,
  expiresAt: 1_800_000_000_000,
};
const NEVER = { ...USED, id: 'never', name: 'Cursor', readOnly: false, lastUsedAt: null };

let deleteStatus = 200;
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  deleteStatus = 200;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      deleteStatus === 200
        ? Response.json({ id: 'used' })
        : Response.json({ error: 'not_found' }, { status: deleteStatus }),
    ),
  );
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const draw = async (compact: boolean, onRevoked = vi.fn()) => {
  await act(async () =>
    root.render(
      withAccountHost(<TokenList tokens={[USED, NEVER]} compact={compact} onRevoked={onRevoked} />),
    ),
  );
  return onRevoked;
};
const press = async (name: string) => {
  const b = [...container.querySelectorAll('button')].find((x) => x.textContent === name)!;
  await act(async () => b.click());
};

describe('TokenList', () => {
  it('draws Settings’ cards with the made, used and expiry dates', async () => {
    await draw(false);
    const list = container.querySelector('ul')!;
    expect(list.className).toContain('space-y-3');
    const rows = [...list.querySelectorAll('li')];
    expect(rows).toHaveLength(2);
    expect(rows[0]!.querySelector('section')).toBeTruthy();
    expect(rows[0]!.textContent).toContain('Read only');
    expect(rows[0]!.textContent).toMatch(/Made .+ · Last used .+ · Expires /);
    expect(rows[1]!.textContent).toContain('Not used yet');
  });

  it('draws one bordered, scrolling list when compact, with when each was last used', async () => {
    await draw(true);
    const list = container.querySelector('ul')!;
    expect(list.className).toContain('max-h-72');
    expect(list.className).toContain('overflow-y-auto');
    const rows = [...list.querySelectorAll('li')];
    expect(rows[0]!.querySelector('section')).toBeNull();
    expect(rows[0]!.textContent).toMatch(/Last used .+ · Made /);
    expect(rows[0]!.textContent).not.toContain('Expires');
    expect(rows[1]!.textContent).toMatch(/Not used yet · Made /);
  });

  it('revokes after Revoke now, and hands back the token revoked', async () => {
    const onRevoked = await draw(true);
    await press('Revoke');
    await press('Revoke now');
    expect(fetch).toHaveBeenCalledWith(
      '/api/account/tokens/used',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(onRevoked).toHaveBeenCalledWith(USED);
  });

  it('says why a revoke was refused, in the row', async () => {
    deleteStatus = 404;
    const onRevoked = await draw(true);
    await press('Revoke');
    await press('Revoke now');
    expect(onRevoked).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')!.textContent).toContain(
      'That’s no longer there',
    );
  });
});
