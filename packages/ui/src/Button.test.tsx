// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button, ButtonContent } from './Button';

// A button's label centres its cap band, not its line box, at the button's usual height
// (docs/specs/004-interface-design/optical-alignment.md).
describe('Button label', () => {
  it('wraps a text label in the line-preserving optical utility', () => {
    const { container } = render(<Button>Save</Button>);
    const label = container.querySelector('button > span') as HTMLElement;
    expect(label.className).toBe('text-optical-line');
    expect(label.textContent).toBe('Save');
  });

  it('wraps each text run beside an icon, and leaves the icon alone', () => {
    const { container } = render(
      <Button>
        <svg data-testid="i" />
        Next {2}
      </Button>,
    );
    const button = container.querySelector('button')!;
    expect(button.firstElementChild!.tagName.toLowerCase()).toBe('svg');
    expect([...button.querySelectorAll('.text-optical-line')].map((s) => s.textContent)).toEqual([
      'Next ',
      '2',
    ]);
  });

  it("measures its padding to an edge icon's ink", () => {
    const { container } = render(<Button>Save</Button>);
    expect(container.querySelector('button')!.className).toContain('optical-edges');
  });

  it('is available to links styled as buttons', () => {
    const { container } = render(
      <a href="/new">
        <ButtonContent>Start drawing</ButtonContent>
      </a>,
    );
    expect(container.querySelector('a > .text-optical-line')?.textContent).toBe('Start drawing');
  });
});

// A button busy with its own action keeps focus: `aria-disabled` looks
// disabled without dropping focus the way `disabled` does.
describe('Button aria-disabled', () => {
  it('looks disabled', () => {
    const { container } = render(<Button aria-disabled>Sync now</Button>);
    expect(container.querySelector('button')!.className).toContain('aria-disabled:opacity-50');
  });
});

// The quiet header-row actions: no fill or border until hovered.
describe('Button ghost variant', () => {
  it('has no border or fill at rest', () => {
    const { container } = render(<Button variant="ghost">Archive</Button>);
    const cls = container.querySelector('button')!.className;
    expect(cls).not.toContain('border');
    expect(cls).toContain('hover:bg-slate-100');
  });
});

// docs/specs/004-interface-design/busy-buttons.md: a busy button keeps the keyboard and ignores a second press.
describe('Button busy', () => {
  function Save({ onSave }: { onSave: () => Promise<void> }) {
    const [busy, setBusy] = useState(false);
    return (
      <Button
        busy={busy}
        onClick={async () => {
          setBusy(true);
          await onSave();
          setBusy(false);
        }}
      >
        {busy ? 'Saving…' : 'Save'}
      </Button>
    );
  }

  it('keeps focus through the wait and ignores a second press', async () => {
    let finish = () => {};
    const onSave = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { container } = render(<Save onSave={onSave} />);
    const button = container.querySelector('button')!;
    button.focus();
    act(() => button.click());
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.disabled).toBe(false);
    expect(document.activeElement).toBe(button);
    act(() => button.click());
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(button.hasAttribute('aria-disabled')).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(document.activeElement).toBe(button);
    act(() => button.click());
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('does not submit its form while busy', () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const { container } = render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent)}>
        <Button type="submit" busy>
          Add
        </Button>
      </form>,
    );
    act(() => container.querySelector('button')!.click());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps an aria-disabled the caller set when not busy', () => {
    const { container } = render(<Button aria-disabled>Sync now</Button>);
    expect(container.querySelector('button')!.getAttribute('aria-disabled')).toBe('true');
    expect(container.querySelector('button')!.hasAttribute('aria-busy')).toBe(false);
  });

  it("takes the caller's own look with variant none, and still reads as disabled while busy", () => {
    const { container } = render(
      <Button variant="none" className="rounded-full bg-slate-900" busy>
        Join
      </Button>,
    );
    const button = container.querySelector('button')!;
    expect(button.className).toBe(
      'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 rounded-full bg-slate-900',
    );
    expect(button.querySelector('.text-optical-line')).toBeNull();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(
      render(<Button variant="none">Bare</Button>).container.querySelector('button')!.className,
    ).toBe('aria-disabled:cursor-not-allowed aria-disabled:opacity-50');
  });
});
