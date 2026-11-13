// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PublicForm } from '@liveplanner/forms';
import type { FormLinkState } from '@/hooks/forms/useFormLink';

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const downloadBlob = vi.hoisted(() => vi.fn());
vi.mock('@liveworkspace/workbench/lib/download-blob', () => ({ downloadBlob }));

import { ShareFormDialog } from '../ShareFormDialog';

// Share Form's More Ways to Share (docs/specs/030-forms/forms.md "Publishing and the form link"): only under a live
// link, closed until opened, then QR Code, Embed and Pre-filled Link.

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const FORM: PublicForm = {
  heading: 'Team "Lunch"',
  confirmation: 'Thanks',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: [
        { id: 'q-name', type: 'short', prompt: 'Name' },
        { id: 'q-food', type: 'single', prompt: 'Food', options: ['Pizza', 'Salad'], other: true },
      ],
    },
  ],
};

const link = (live: boolean): FormLinkState => ({
  link: {
    link: live ? { code: 'AbCdEfGhIjKlMnOpQrStU1', open: true, createdAt: 1 } : null,
    responses: 0,
    unseen: 0,
    suspendedAt: null,
    canPublish: true,
  },
  status: 'ready',
  busy: false,
  error: null,
  publish: vi.fn(async () => true),
  setOpen: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
  reload: vi.fn(),
});

const URL_ = `${window.location.origin}/form/AbCdEfGhIjKlMnOpQrStU1`;

function open(live = true) {
  render(
    <ShareFormDialog
      open
      onClose={() => {}}
      link={link(live)}
      problem={null}
      onFixDestination={() => {}}
      form={FORM}
    />,
  );
}

const writeText = vi.fn(async (_: string) => {});
Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

async function openMore() {
  const header = screen.getByRole('button', { name: /More Ways to Share/ });
  expect(header.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(header);
  expect(header.getAttribute('aria-expanded')).toBe('true');
  await screen.findByRole('group', { name: 'Ways to share' });
}

describe('More Ways to Share', () => {
  it('is not offered before the form is published', () => {
    open(false);
    expect(screen.queryByRole('button', { name: /More Ways to Share/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Publish Form' })).toBeTruthy();
  });

  it('loads nothing until opened, then draws the QR code with its downloads', async () => {
    open();
    expect(screen.queryByRole('group', { name: 'Ways to share' })).toBeNull();
    await openMore();
    const qr = await screen.findByRole('img', { name: 'QR code for the form link' });
    expect(qr.querySelector('path')!.getAttribute('d')).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
    fireEvent.click(screen.getByRole('button', { name: 'Download SVG' }));
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'Team Lunch QR Code.svg');
    expect(track).toHaveBeenCalledWith('Form', 'Shared', 'QrSvg');
    const svg = await (downloadBlob.mock.calls[0]![0] as Blob).text();
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    // jsdom has no canvas: the PNG is skipped rather than saved broken.
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Download PNG' })));
    expect(track).toHaveBeenCalledWith('Form', 'Shared', 'QrPng');
    expect(downloadBlob).toHaveBeenCalledTimes(1);
  });

  it('gives the embed code, its height and Copy Code', async () => {
    open();
    await openMore();
    fireEvent.click(screen.getByRole('button', { name: 'Embed' }));
    const code = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Embed code' });
    expect(code.value).toBe(
      `<iframe src="${URL_}" title="Team &quot;Lunch&quot;" width="100%" height="720" style="border:0;max-width:640px" loading="lazy"></iframe>`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tall' }));
    expect(code.value).toContain('height="960"');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy Code' })));
    expect(writeText).toHaveBeenCalledWith(code.value);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    expect(track).toHaveBeenCalledWith('Form', 'Shared', 'Embed');
  });

  it('builds a pre-filled link from the answers picked, without Other, and clears them', async () => {
    open();
    await openMore();
    fireEvent.click(screen.getByRole('button', { name: 'Pre-filled Link' }));
    const out = screen.getByRole<HTMLInputElement>('textbox', { name: 'Pre-filled link' });
    expect(out.value).toBe(URL_);
    expect(
      screen.getByText('Pick answers above to fill them in for whoever opens the link.'),
    ).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Copy Pre-filled Link' }).disabled,
    ).toBe(true);
    // The Other option is not offered: an address never carries typed text.
    expect(screen.queryByRole('radio', { name: /Other/ })).toBeNull();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada Lovelace' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Salad' }));
    expect(out.value).toBe(`${URL_}?q.q-name=Ada+Lovelace&q.q-food=Salad`);
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Copy Pre-filled Link' })),
    );
    expect(writeText).toHaveBeenCalledWith(out.value);
    expect(track).toHaveBeenCalledWith('Form', 'Shared', 'Prefilled');

    // Switching away and back keeps the picks while the dialog is open.
    fireEvent.click(screen.getByRole('button', { name: 'QR Code' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pre-filled Link' }));
    const again = screen.getByRole<HTMLInputElement>('textbox', { name: 'Pre-filled link' });
    expect(again.value).toContain('q.q-food=Salad');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(again.value).toBe(URL_);
  });
});
