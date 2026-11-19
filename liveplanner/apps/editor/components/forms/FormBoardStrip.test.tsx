// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sentUrl } from '@liveworkspace/vitest-config/sent-request';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Tab } from '@liveplanner/project';
import { formsFeeding } from '@/hooks/forms/forms-feeding';
import { FormBoardStrip } from './FormBoardStrip';
import { FormBoardContext, type FormBoardValue } from './form-board-context';

// A board's Form strip (docs/specs/030-forms/forms.md "On the board").

const palette = {
  surface: '#fff',
  border: '#ddd',
  column: '#eee',
  card: '#fff',
  cardBorder: '#ddd',
  text: '#111',
  muted: '#666',
  warning: '#b45309',
  warningBg: '#fef3c7',
  focus: '#0284c7',
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        link: { code: 'AbCdEfGhIjKlMnOpQrStU1', open: true, createdAt: 1 },
        responses: 3,
        unseen: 1,
        suspendedAt: null,
        canPublish: true,
      }),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const value = (over: Partial<FormBoardValue> = {}): FormBoardValue => ({
  forms: [{ tabId: 'f1', heading: 'Bug Report' }],
  projectId: 'd1',
  ownerId: 'me',
  share: null,
  online: true,
  canShare: true,
  openTab: vi.fn(),
  ...over,
});

describe('formsFeeding', () => {
  it('finds the Form tabs whose responses go to a tab', () => {
    const form = (id: string, to: string): Tab => ({
      id,
      name: id,
      elements: [],
      kind: 'form',
      form: {
        v: 1,
        heading: `Form ${id}`,
        sections: [{ id: 's-1', title: '', questions: [] }],
        destination: { tabId: to, typeId: 'bug', status: 'new' },
      },
    });
    const tabs: Tab[] = [
      form('a', 'board'),
      form('b', 'other'),
      { id: 'board', name: 'B', elements: [] },
    ];
    expect(formsFeeding(tabs, 'board')).toEqual([{ tabId: 'a', heading: 'Form a' }]);
  });
});

describe('FormBoardStrip', () => {
  it('draws nothing without the editor or a form feeding the board', () => {
    const { container } = render(<FormBoardStrip palette={palette} />);
    expect(container.innerHTML).toBe('');
    render(
      <FormBoardContext.Provider value={value({ forms: [] })}>
        <FormBoardStrip palette={palette} />
      </FormBoardContext.Provider>,
    );
    expect(document.querySelector('[data-form-strip]')).toBeNull();
  });

  it('shows the form, its count without marking it seen, Copy Link and Open Form', async () => {
    const v = value();
    render(
      <FormBoardContext.Provider value={v}>
        <FormBoardStrip palette={palette} />
      </FormBoardContext.Provider>,
    );
    expect(await screen.findByRole('group', { name: 'Bug Report, 3 responses' })).toBeTruthy();
    expect(document.querySelector('[data-form-strip-count]')!.textContent).toMatch(/^3 responses/);
    expect(screen.getByText(/1 new/)).toBeTruthy();
    // Read, never the form-seen door.
    expect(sentUrl(vi.mocked(fetch).mock.calls[0]![0])).toMatch(/form-link$/);
    fireEvent.click(screen.getByRole('button', { name: 'Open form Bug Report' }));
    expect(v.openTab).toHaveBeenCalledWith('f1');
    expect(screen.getByRole('button', { name: 'Copy form link' })).toBeTruthy();
  });

  // Work Tracker 1288: at 390 px the pill ran on under the top-right corner card. It now gives way inside the header:
  // nothing in it holds its width (no shrink-0 on the strip or the pill), the name truncates first and on a phone
  // leaves sight, and the glyph, dot and buttons never shrink.
  it('gives way when the header runs short, never running under the corner card', async () => {
    render(
      <FormBoardContext.Provider value={value()}>
        <FormBoardStrip palette={palette} />
      </FormBoardContext.Provider>,
    );
    await screen.findByRole('group', { name: 'Bug Report, 3 responses' });
    const classes = (el: Element | null) => (el?.getAttribute('class') ?? '').split(' ');
    const strip = document.querySelector('[data-form-strip]');
    expect(classes(strip)).toEqual(expect.arrayContaining(['min-w-0', 'shrink']));
    expect(classes(strip)).not.toContain('shrink-0');
    const pill = screen.getByRole('group', { name: 'Bug Report, 3 responses' });
    expect(classes(pill)).toEqual(expect.arrayContaining(['min-w-0', 'shrink']));
    expect(classes(pill)).not.toContain('shrink-0');
    const name = document.querySelector('[data-form-strip-name]');
    expect(name?.textContent).toBe('Bug Report');
    expect(classes(name)).toEqual(expect.arrayContaining(['min-w-0', 'truncate', 'phone:sr-only']));
    expect(classes(document.querySelector('[data-form-strip-count]'))).toContain('min-w-0');
    for (const button of screen.getAllByRole('button'))
      expect(classes(button)).toContain('shrink-0');
  });

  // Work Tracker 1288 follow-up: a phone showed a cut-off "0 res…". The count stands alone there ("3"), the word kept out
  // of sight and in the pill's name, so it reads whole.
  it('shows the count alone on a phone, the word kept in the name', async () => {
    render(
      <FormBoardContext.Provider value={value()}>
        <FormBoardStrip palette={palette} />
      </FormBoardContext.Provider>,
    );
    await screen.findByRole('group', { name: 'Bug Report, 3 responses' });
    const count = document.querySelector('[data-form-strip-count]')!;
    const word = count.querySelector('.phone\\:sr-only')!;
    expect(word.textContent).toBe(' responses');
    expect(count.firstChild!.textContent).toBe('3');
  });

  it('offers no Copy Link to someone who may not share it', async () => {
    render(
      <FormBoardContext.Provider value={value({ canShare: false })}>
        <FormBoardStrip palette={palette} />
      </FormBoardContext.Provider>,
    );
    await screen.findByRole('group', { name: 'Bug Report, 3 responses' });
    expect(screen.queryByRole('button', { name: 'Copy form link' })).toBeNull();
  });
});
