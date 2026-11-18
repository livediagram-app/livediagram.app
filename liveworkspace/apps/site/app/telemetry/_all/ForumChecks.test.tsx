// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForumChecksResponse } from '@liveworkspace/community';
import { ForumChecks } from './ForumChecks';

// Forum Checks (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard"): the Forum check's day against its
// caps, read from the Community service.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 20);
const answer: ForumChecksResponse = {
  caps: { checks: 500, neurons: 8000 },
  days: Array.from({ length: 30 }, (_, i) => ({
    day: START + i * DAY,
    listed: i === 29 ? 120 : 0,
    refused: i === 29 ? 5 : 0,
    waiting: i === 29 ? 3 : 0,
    neurons: i === 29 ? 1250 : 0,
  })),
};

let root: Root | null = null;
let host: HTMLElement | null = null;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  vi.unstubAllGlobals();
  act(() => root?.unmount());
  host?.remove();
});

async function show(fetcher: () => Promise<Response>) {
  const asked: string[] = [];
  vi.stubGlobal('fetch', (url: string) => {
    asked.push(url);
    return fetcher();
  });
  await act(async () => {
    root!.render(<ForumChecks />);
  });
  return asked;
}

describe('Forum Checks', () => {
  it("shows today's checks and Neurons against the caps, from the service's counts route", async () => {
    const asked = await show(async () => Response.json(answer));
    expect(asked[0]).toMatch(/\/api\/community\/forum\/checks$/);
    const text = host!.textContent;
    expect(text).toContain('Checks Today');
    expect(text).toContain('128');
    expect(text).toContain('of 500 a day');
    expect(text).toContain('1,250');
    expect(text).toContain('of 8,000 a day');
    expect(text).toContain('10.0');
    expect(host!.querySelectorAll('table')).toHaveLength(2);
  });

  it('shows zero Neurons per check before any check has answered', async () => {
    const quiet = { ...answer, days: answer.days.map((d) => ({ ...d, listed: 0, refused: 0 })) };
    await show(async () => Response.json(quiet));
    expect(host!.textContent).toContain('Neurons per Check');
    expect(host!.textContent).toContain('0');
  });

  it('says so when the service does not answer', async () => {
    await show(async () => new Response('', { status: 503 }));
    expect(host!.textContent).toContain('Forum Checks Unavailable');
  });

  it('says it is loading until the service answers', async () => {
    vi.stubGlobal('fetch', () => new Promise(() => {}));
    await act(async () => {
      root!.render(<ForumChecks />);
    });
    expect(host!.textContent).toContain('Loading Forum Checks');
  });
});
