// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch';

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
    const { container, rerender } = render(<Switch checked={false} label="On" onChange={() => {}} />);
    const sw = screen.getByRole('switch');
    expect(sw.className).toContain('h-11');
    const knob = container.querySelector('[data-switch-knob]')!;
    expect(knob.className).toContain('translate-x-[2px]');
    expect(knob.className).toContain('motion-reduce:transition-none');
    rerender(<Switch checked label="On" onChange={() => {}} />);
    expect(container.querySelector('[data-switch-knob]')!.className).toContain('translate-x-[20px]');
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
});
