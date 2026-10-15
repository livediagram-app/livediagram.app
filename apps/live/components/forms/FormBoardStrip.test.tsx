// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Tab } from '@livediagram/document';
import { formsFeeding } from '@/hooks/forms/useFormBoardValue';
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
  documentId: 'd1',
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
    expect(await screen.findByText(/3 responses/)).toBeTruthy();
    expect(screen.getByText(/1 new/)).toBeTruthy();
    // Read, never the form-seen door.
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toMatch(/form-link$/);
    fireEvent.click(screen.getByRole('button', { name: 'Open form Bug Report' }));
    expect(v.openTab).toHaveBeenCalledWith('f1');
    expect(screen.getByRole('button', { name: 'Copy form link' })).toBeTruthy();
  });

  it('offers no Copy Link to someone who may not share it', async () => {
    render(
      <FormBoardContext.Provider value={value({ canShare: false })}>
        <FormBoardStrip palette={palette} />
      </FormBoardContext.Provider>,
    );
    await screen.findByText(/3 responses/);
    expect(screen.queryByRole('button', { name: 'Copy form link' })).toBeNull();
  });
});
