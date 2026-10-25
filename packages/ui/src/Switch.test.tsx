// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Switch, SwitchChip, SwitchRow } from './Switch';

describe('Switch', () => {
  it('is one switch, named and checked as given', () => {
    render(<Switch checked label="Sync Plan to Server" onChange={() => {}} />);
    const sw = screen.getByRole('switch', { name: 'Sync Plan to Server' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(sw.tagName).toBe('BUTTON');
    expect(sw.getAttribute('type')).toBe('button');
  });

  it('flips on a click, to the other side', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} label="On" onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('flips once on Space, holding back the release click and a held key', () => {
    const onChange = vi.fn();
    render(<Switch checked label="On" onChange={onChange} />);
    const sw = screen.getByRole('switch');
    const down = fireEvent.keyDown(sw, { key: ' ' });
    fireEvent.keyDown(sw, { key: ' ', repeat: true });
    const up = fireEvent.keyUp(sw, { key: ' ' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
    // Default prevented, so the browser never adds its own click on release.
    expect(down).toBe(false);
    expect(up).toBe(false);
  });

  it('holds still while busy, focusable and announced as busy', () => {
    const onChange = vi.fn();
    const { container } = render(<Switch checked={false} busy label="On" onChange={onChange} />);
    const sw = screen.getByRole('switch');
    fireEvent.click(sw);
    fireEvent.keyDown(sw, { key: ' ' });
    expect(onChange).not.toHaveBeenCalled();
    expect(sw.getAttribute('aria-busy')).toBe('true');
    expect(sw.hasAttribute('disabled')).toBe(false);
    expect(container.querySelector('[data-switch-spinner]')).not.toBeNull();
  });

  it('is disabled when asked, and flips for nothing', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} disabled label="On" onChange={onChange} />);
    const sw = screen.getByRole('switch');
    expect(sw.hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(sw, { key: ' ' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is a 44px hit area, slides its knob, and respects reduced motion', () => {
    const { container, rerender } = render(
      <Switch checked={false} label="On" onChange={() => {}} />,
    );
    const sw = screen.getByRole('switch');
    expect(sw.className).toContain('h-11');
    const knob = container.querySelector('[data-switch-knob]')!;
    expect(knob.className).toContain('translate-x-[2px]');
    expect(knob.className).toContain('motion-reduce:transition-none');
    rerender(<Switch checked label="On" onChange={() => {}} />);
    expect(container.querySelector('[data-switch-knob]')!.className).toContain(
      'translate-x-[20px]',
    );
  });

  it('paints the brand track on and slate off, or the colours a panel hands in', () => {
    const { container, rerender } = render(<Switch checked label="On" onChange={() => {}} />);
    const track = () => container.querySelector<HTMLElement>('[data-switch-track]')!;
    expect(track().className).toContain('bg-brand-500');
    rerender(<Switch checked={false} label="On" onChange={() => {}} />);
    expect(track().className).toContain('bg-slate-300');
    rerender(<Switch checked label="On" onColor="#ff0000" onChange={() => {}} />);
    expect(track().style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('draws md by default, and sm and xs as the compact tracks, each keeping a 44px touch target', () => {
    const { container, rerender } = render(
      <Switch checked={false} label="On" onChange={() => {}} />,
    );
    const sw = () => screen.getByRole('switch');
    const track = () => container.querySelector<HTMLElement>('[data-switch-track]')!;
    const knob = () => container.querySelector<HTMLElement>('[data-switch-knob]')!;
    expect(sw().getAttribute('data-switch-size')).toBe('md');
    expect(track().className).toContain('h-[26px] w-11');

    // sm is the compact switch Settings and the editors drew before (ToggleSwitch), to the pixel.
    rerender(<Switch size="sm" checked={false} label="On" onChange={() => {}} />);
    expect(sw().getAttribute('data-switch-size')).toBe('sm');
    expect(sw().className).not.toContain('h-11');
    expect(sw().className).toContain('touch-target');
    expect(sw().className).toMatch(/(^|\s)relative(\s|$)/);
    expect(track().className).toContain('h-5 w-9');
    expect(knob().className).toContain('h-3.5 w-3.5');
    expect(knob().className).toContain('translate-x-[3px]');
    rerender(<Switch size="sm" checked label="On" onChange={() => {}} />);
    expect(knob().className).toContain('translate-x-[18px]');

    rerender(<Switch size="xs" checked label="On" onChange={() => {}} />);
    expect(sw().className).toContain('touch-target');
    expect(track().className).toContain('h-4 w-7');
    expect(knob().className).toContain('translate-x-[14px]');
  });

  it('flips the same way at every size', () => {
    for (const size of ['xs', 'sm', 'md'] as const) {
      const onChange = vi.fn();
      const { unmount } = render(
        <Switch size={size} checked={false} label="On" onChange={onChange} />,
      );
      const sw = screen.getByRole('switch', { name: 'On' });
      fireEvent.click(sw);
      fireEvent.keyDown(sw, { key: ' ' });
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith(true);
      unmount();
    }
  });

  it('covers its row instead of padding itself when coversRow, at any size', () => {
    render(<Switch size="sm" coversRow checked label="On" onChange={() => {}} />);
    const sw = screen.getByRole('switch');
    expect(sw.className).toContain('after:absolute');
    expect(sw.className).not.toMatch(/(^|\s)relative(\s|$)/);
    expect(sw.className).not.toContain('touch-target');
  });

  it('is a picture only when presentational: no switch, no button, hidden from assistive tech', () => {
    const { container } = render(<Switch presentational size="sm" checked />);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    const pic = container.querySelector<HTMLElement>('[data-switch]')!;
    expect(pic.getAttribute('aria-hidden')).toBe('true');
    expect(pic.querySelector('[data-switch-track]')!.className).toContain('bg-brand-500');
  });

  it('draws what the caller puts in the knob, and the spinner over it while busy', () => {
    const { container, rerender } = render(
      <Switch checked label="On" knob={<i data-glyph="" />} onChange={() => {}} />,
    );
    expect(container.querySelector('[data-switch-knob] [data-glyph]')).not.toBeNull();
    rerender(<Switch checked busy label="On" knob={<i data-glyph="" />} onChange={() => {}} />);
    expect(container.querySelector('[data-switch-knob] [data-glyph]')).toBeNull();
    expect(container.querySelector('[data-switch-spinner]')).not.toBeNull();
  });
});

describe('SwitchRow', () => {
  it('is one switch named by its words, with the track drawn inside as a picture', () => {
    const onChange = vi.fn();
    const { container } = render(
      <SwitchRow checked={false} onChange={onChange} data-tour-id="row">
        <span>Always save</span>
      </SwitchRow>,
    );
    const row = screen.getByRole('switch', { name: 'Always save' });
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(row.getAttribute('aria-checked')).toBe('false');
    expect(row.getAttribute('data-tour-id')).toBe('row');
    expect(container.querySelector('[data-switch][aria-hidden="true"]')).not.toBeNull();
    fireEvent.click(row);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("runs the caller's click first, and holds the flip when it prevents the default", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SwitchRow checked onChange={onChange} onClick={(e) => e.stopPropagation()}>
        On
      </SwitchRow>,
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
    rerender(
      <SwitchRow checked onChange={onChange} onClick={(e) => e.preventDefault()}>
        On
      </SwitchRow>,
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not flip while disabled', () => {
    const onChange = vi.fn();
    render(
      <SwitchRow checked={false} disabled onChange={onChange}>
        On
      </SwitchRow>,
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('puts the track first when asked, and none as a chip', () => {
    const { container, rerender } = render(
      <SwitchRow checked onChange={() => {}} track="start" size="xs">
        <span data-words="">On</span>
      </SwitchRow>,
    );
    const row = screen.getByRole('switch');
    expect(row.firstElementChild!.hasAttribute('data-switch')).toBe(true);
    expect(container.querySelector('[data-switch]')!.getAttribute('data-switch-size')).toBe('xs');
    rerender(
      <SwitchChip checked onChange={() => {}} className="chip">
        Grid
      </SwitchChip>,
    );
    expect(container.querySelector('[data-switch]')).toBeNull();
    expect(screen.getByRole('switch', { name: 'Grid' }).className).toContain('chip');
  });
});
