// Home's picks, reported through onHome as Home·Selected: a card opened from Most Used (`MostUsed`) or Recent
// (`Recent`), or See More followed to the Recent view (`SeeMore`), the names Jump Back In's picks took in November
// 2026 (liveworkspace/docs/specs/008-telemetry/telemetry.md "The Explorer on liveworkspace.app").
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { Explorer } from './Explorer';
import type { HomeTelemetry } from '../types';

afterEach(() => vi.unstubAllGlobals());

const opened = (i: number, extra = {}) => makeItem(i, { lastOpenedAt: 5_000_000 - i, ...extra });
const items = () =>
  Array.from({ length: 6 }, (_, k) => opened(k + 1, k < 2 ? { useOpens: 30 - k, useDays: 1 } : {}));

const renderHome = (onHome?: HomeTelemetry) => {
  const index = createFakeIndex({ items: items() });
  render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'home' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      heroHidden
      onHome={onHome}
    />,
  );
};
const section = (id: string) => document.querySelector<HTMLElement>(`[data-home-section="${id}"]`);
const firstCard = (el: HTMLElement) =>
  el.querySelector<HTMLAnchorElement>('[data-item-card] a[href]') as HTMLAnchorElement;

describe("Home's picks", () => {
  it('reports a card opened from Most Used, and one from Recent', async () => {
    const onHome = vi.fn();
    renderHome(onHome);
    await waitFor(() =>
      expect(section('most-used')?.querySelector('[data-item-card]')).toBeTruthy(),
    );
    fireEvent.click(firstCard(section('most-used')!));
    await waitFor(() => expect(section('recent')?.querySelector('[data-item-card]')).toBeTruthy());
    fireEvent.click(firstCard(section('recent')!));
    expect(onHome.mock.calls).toEqual([
      ['Selected', 'MostUsed'],
      ['Selected', 'Recent'],
    ]);
  });

  it('reports See More, and nothing for a press that follows no link', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    const onHome = vi.fn();
    renderHome(onHome);
    await waitFor(() => expect(section('recent')?.querySelector('[data-see-link]')).toBeTruthy());
    fireEvent.click(within(section('recent')!).getByRole('heading'));
    fireEvent.click(section('recent')!.querySelector('[data-see-link]')!);
    expect(onHome.mock.calls).toEqual([['Selected', 'SeeMore']]);
  });

  it('asks nothing of a host with no telemetry', async () => {
    renderHome();
    await waitFor(() =>
      expect(section('most-used')?.querySelector('[data-item-card]')).toBeTruthy(),
    );
    expect(() => fireEvent.click(firstCard(section('most-used')!))).not.toThrow();
  });
});
