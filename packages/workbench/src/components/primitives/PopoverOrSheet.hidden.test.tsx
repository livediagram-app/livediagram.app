// @vitest-environment jsdom
// A footer popover stepping aside (liveworkspace/docs/specs/004-index/footer-tools-menu.md "Stepping aside"): open,
// its content kept, but out of sight, as a popover and as a phone's drawer, and back in sight when the mark clears.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnchoredPopover } from './AnchoredPopover';
import { PopoverOrSheet } from './PopoverOrSheet';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function phone(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

function anchor() {
  const el = document.createElement('button');
  document.body.appendChild(el);
  return el;
}

function Tools({ at, hidden }: { at: HTMLElement; hidden: boolean }) {
  return (
    <PopoverOrSheet anchor={at} name="Tools" width={480} onClose={() => undefined} hidden={hidden}>
      {() => <p>Tool view</p>}
    </PopoverOrSheet>
  );
}

describe('PopoverOrSheet hidden', () => {
  it('keeps a popover open but out of sight, then shows it again', () => {
    phone(false);
    const at = anchor();
    const view = render(<Tools at={at} hidden />);
    const panel = screen.getByRole('dialog', { name: 'Tools' });
    expect(panel.hasAttribute('data-stepped-aside')).toBe(true);
    expect(panel.className.split(' ')).toContain('invisible');
    expect(screen.getByText('Tool view')).toBeTruthy();
    view.rerender(<Tools at={at} hidden={false} />);
    expect(panel.hasAttribute('data-stepped-aside')).toBe(false);
    expect(panel.className.split(' ')).not.toContain('invisible');
  });

  it('keeps a phone drawer and its scrim open but out of sight', () => {
    phone(true);
    const at = anchor();
    const view = render(<Tools at={at} hidden />);
    const sheet = document.querySelector<HTMLElement>('[data-popover-sheet]')!;
    const scrim = sheet.previousElementSibling as HTMLElement;
    expect(sheet.className.split(' ')).toContain('invisible');
    expect(scrim.className.split(' ')).toContain('invisible');
    view.rerender(<Tools at={at} hidden={false} />);
    expect(sheet.className.split(' ')).not.toContain('invisible');
    expect(scrim.className.split(' ')).not.toContain('invisible');
  });

  it('draws no scrim and hides its pointer while hidden', () => {
    phone(false);
    const at = anchor();
    render(
      <AnchoredPopover anchor={at} name="Sort" width={300} scrim pointer hidden onClose={vi.fn()}>
        <p>Body</p>
      </AnchoredPopover>,
    );
    expect(document.querySelector('[data-anchored-popover-scrim]')).toBeNull();
    const arrow = document.querySelector<HTMLElement>('[data-popover-pointer]')!;
    expect(arrow.className.split(' ')).toContain('invisible');
  });
});
