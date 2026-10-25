// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelemetrySummary } from '@liveworkspace/telemetry';
import TelemetryDashboard from './page';

// The page never empties while numbers load (liveworkspace/docs/telemetry.md "The dashboard",
// Loading): the first visit and a switch to an app not fetched yet keep the chrome on screen with a
// skeleton where the numbers go, and the numbers replace it once they land.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The site's header and footer bring the account and settings with them; the page's own chrome is
// what this checks.
vi.mock('@/components/Header', () => ({ Header: () => <header data-testid="header" /> }));
vi.mock('@/components/Footer', () => ({ Footer: () => <footer /> }));
vi.mock('./livediagram/Body', () => ({
  Body: ({ summary }: { summary: TelemetrySummary }) => (
    <p data-testid="livediagram-body">{summary.windows.today.total} today</p>
  ),
}));

const window = (total: number) => ({ total, rows: [] });
const summary = (today: number): TelemetrySummary => ({
  enabled: true,
  generatedAt: 1,
  windows: { today: window(today), last7: window(today), last30: window(today) },
});

// Each request answers only when the test says so.
let pending: { url: string; resolve: (body: TelemetrySummary) => void }[] = [];

let root: Root | null = null;
let host: HTMLElement | null = null;

beforeEach(() => {
  pending = [];
  globalThis.window.history.replaceState(null, '', '/telemetry');
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url: string) =>
        new Promise((resolve) => {
          pending.push({
            url,
            resolve: (body) => resolve({ ok: true, json: () => Promise.resolve(body) }),
          });
        }),
    ),
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.unstubAllGlobals();
});

const skeleton = () => host!.querySelector('[data-testid="telemetry-skeleton"]');
const chip = (label: string) =>
  host!.querySelector<HTMLButtonElement>(`[role="radio"][aria-label="${label}"]`);

// The page's chrome: the header, its title, the app chips and the closing note.
function expectChrome() {
  expect(host!.querySelector('[data-testid="header"]')).not.toBeNull();
  expect(host!.querySelector('h1')?.textContent).toBe('Telemetry, in the open');
  expect(host!.querySelectorAll('[role="radio"]').length).toBeGreaterThan(1);
  expect(host!.textContent).toContain('Anonymous, first-party, no vendors.');
}

async function answer(i: number, body: TelemetrySummary) {
  await act(async () => {
    pending[i]!.resolve(body);
    // The body's code (next/dynamic) and the response's JSON both settle on later ticks.
    for (let n = 0; n < 5; n++) await new Promise((r) => setTimeout(r, 0));
  });
}

describe('the telemetry dashboard while it loads', () => {
  it('shows the chrome and the All apps skeleton on the first load, then the numbers', async () => {
    act(() => root!.render(<TelemetryDashboard />));
    expectChrome();
    expect(skeleton()).not.toBeNull();
    expect(skeleton()!.getAttribute('aria-busy')).toBe('true');
    // Shaped like All apps: its section titles and a card per app.
    expect(skeleton()!.textContent).toContain('By app');
    expect(skeleton()!.textContent).toContain('Busiest events');
    expect(pending).toHaveLength(1);

    await answer(0, summary(7));
    expect(skeleton()).toBeNull();
    expect(host!.textContent).toContain('Open its dashboard');
  });

  it('keeps the chrome and shows the app skeleton while a switch loads, then the app', async () => {
    act(() => root!.render(<TelemetryDashboard />));
    await answer(0, summary(7));
    expect(skeleton()).toBeNull();

    act(() => chip('livediagram.app')!.click());
    expect(pending).toHaveLength(2);
    expect(pending[1]!.url).toContain('app=livediagram.app');
    // Pending: the page is not empty, the chip is picked, the skeleton stands in.
    expectChrome();
    expect(chip('livediagram.app')!.getAttribute('aria-checked')).toBe('true');
    expect(skeleton()).not.toBeNull();
    expect(host!.querySelector('[data-testid="livediagram-body"]')).toBeNull();

    await answer(1, summary(42));
    expect(skeleton()).toBeNull();
    expect(host!.querySelector('[data-testid="livediagram-body"]')?.textContent).toBe('42 today');

    // Back to All apps: already fetched, so it shows at once with no skeleton and no request.
    act(() => chip('All apps')!.click());
    expect(skeleton()).toBeNull();
    expect(pending).toHaveLength(2);
    expect(host!.textContent).toContain('Open its dashboard');
  });
});
