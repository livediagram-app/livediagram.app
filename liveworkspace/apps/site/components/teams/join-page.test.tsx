// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JoinPage } from './JoinPage';

// A team's join link (liveworkspace/docs/specs/010-site/site.md "Joining and declining"): the team's name, its
// organisation and how many are in it, before anything else.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../Header', () => ({ Header: () => null }));
vi.mock('../Footer', () => ({ Footer: () => null }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.history.replaceState(null, '', '/join?token=abc');
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            teamId: 't1',
            teamName: 'צוות',
            organisation: '\u202Eevil org',
            memberCount: 3,
            signedIn: true,
            alreadyMember: false,
          }),
          { status: 200 },
        ),
      ),
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

describe('JoinPage', () => {
  it('isolates the organisation, so its direction never turns the member count around', async () => {
    act(() => root.render(<JoinPage />));
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    const bdi = container.querySelector('p bdi');
    expect(bdi?.textContent).toBe('\u202Eevil org');
    expect(bdi?.parentElement?.textContent).toBe('\u202Eevil org · 3 members');
  });

  it('isolates the team’s name in its heading and on Join, so a right-to-left name keeps the button the right way round', async () => {
    act(() => root.render(<JoinPage />));
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(container.querySelector('h1 bdi')?.textContent).toBe('צוות');
    const join = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.startsWith('Join'),
    );
    expect(join?.textContent).toBe('Join \u2068צוות\u2069');
  });

  it('holds its header, card and footer in a column at least the window high, so a short page keeps its footer at the foot', async () => {
    act(() => root.render(<JoinPage />));
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    const shell = container.querySelector('[data-join-shell]')!;
    expect(shell.className).toContain('min-h-dvh');
    expect(shell.className).toContain('flex-col');
    expect(shell.querySelector(':scope > main')?.className).toContain('flex-1');
  });
});
