// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsToggleRow } from './SettingsToggleRow';

describe('SettingsToggleRow', () => {
  it('is one switch, named by its label and hint, drawing the compact track', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <SettingsToggleRow label="Minimap" hint="A small map" checked onToggle={onToggle} />,
    );
    const row = screen.getByRole('switch', { name: /Minimap/ });
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(row.getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('[data-switch]')!.getAttribute('data-switch-size')).toBe('sm');
    fireEvent.click(row);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('keeps its help link beside the row, never inside it', () => {
    render(
      <SettingsToggleRow
        label="Minimap"
        hint="A small map"
        checked={false}
        onToggle={() => {}}
        help={<a href="/help">?</a>}
      />,
    );
    expect(screen.getByRole('switch').querySelector('a')).toBeNull();
    expect(screen.getByRole('link', { name: '?' })).toBeTruthy();
  });

  it('shows but does not flip while disabled', () => {
    const onToggle = vi.fn();
    render(
      <SettingsToggleRow
        label="Minimap"
        hint="A small map"
        checked={false}
        disabled
        onToggle={onToggle}
      />,
    );
    const row = screen.getByRole('switch');
    expect(row.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(row);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
