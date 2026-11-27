// Home's rail is narrow, so Most Used and Shared With You Recently show Made by AI as its icon alone, named for a
// screen reader and in its tooltip; Recent's timeline keeps the worded chip (one-explorer.md "Home's rail", Work
// Tracker 1494).
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, madeLater, makeItem } from '../test/fakeClient';
import { Explorer } from './Explorer';

afterEach(() => localStorage.clear());

const section = (id: string) => document.querySelector<HTMLElement>(`[data-home-section="${id}"]`);

function renderHome() {
  const used = Array.from({ length: 6 }, (_, k) =>
    makeItem(k + 1, {
      lastOpenedAt: 5_000_000 - k,
      source: 'ai',
      ...(k < 2 ? { useOpens: 30 - k, useDays: 1 } : {}),
    }),
  );
  const shared = makeItem(20, {
    ownerId: 'user_other',
    sharedVia: 'code1',
    access: 'view',
    lastOpenedAt: 4_000_000,
    source: 'ai',
  });
  render(
    <Explorer
      app="liveplanner"
      client={createFakeIndex({ items: [...used, shared, ...madeLater()] }).client}
      view={{ kind: 'home' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
      heroHidden
    />,
  );
}

describe('Made by AI on Home', () => {
  it('is the icon alone in Most Used and Shared With You Recently, named Made by AI', async () => {
    renderHome();
    await waitFor(() =>
      expect(section('most-used')?.querySelector('[data-made-by-ai]')).toBeTruthy(),
    );
    await waitFor(() =>
      expect(section('shared-recently')?.querySelector('[data-made-by-ai]')).toBeTruthy(),
    );
    for (const id of ['most-used', 'shared-recently']) {
      const marks = [...section(id)!.querySelectorAll<HTMLElement>('[data-made-by-ai]')];
      expect(marks.length).toBeGreaterThan(0);
      for (const mark of marks) {
        expect(mark.hasAttribute('data-made-by-ai-icon')).toBe(true);
        expect(mark.getAttribute('role')).toBe('img');
        expect(mark.getAttribute('aria-label')).toBe('Made by AI');
        expect(mark.textContent).toBe('');
      }
    }
  });

  it('keeps its words in Recent', async () => {
    renderHome();
    await waitFor(() => expect(section('recent')?.querySelector('[data-made-by-ai]')).toBeTruthy());
    const mark = section('recent')!.querySelector<HTMLElement>('[data-made-by-ai]')!;
    expect(mark.hasAttribute('data-made-by-ai-icon')).toBe(false);
    expect(mark.textContent).toContain('Made by AI');
  });
});
