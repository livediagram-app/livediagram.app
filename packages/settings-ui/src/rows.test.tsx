// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SettingsToggleGroupRow } from './model';
import { SettingsChoiceRowView } from './rows/ChoiceRow';
import { SettingsLinkRowView, SettingsNoteRowView } from './rows/SimpleRows';
import { SettingsToggleGroupRowView } from './rows/ToggleGroupRow';
import { SettingsRowShell } from './SettingsRowShell';
import { renderWithKit } from './test/kit';

// The generic rows (each app's docs/specs/007-editor/user-preferences.md).

describe('SettingsRowShell', () => {
  it('says "All apps" in the description of a setting every app shares', () => {
    renderWithKit(
      <SettingsRowShell
        row={{
          key: 'reduceMotion',
          label: 'Reduce Motion',
          description: 'Less movement.',
          allApps: true,
        }}
      />,
    );
    expect(screen.getByText('All apps').closest('#reduceMotion-description')).not.toBeNull();
  });

  it('leaves an app’s own setting unmarked, and ends the description with its help link', () => {
    renderWithKit(
      <SettingsRowShell
        row={{
          key: 'showMinimap',
          label: 'Minimap',
          description: 'A map.',
          helpArticle: 'minimap',
        }}
      />,
    );
    expect(screen.queryByText('All apps')).toBeNull();
    expect(screen.getByRole('link', { name: 'Learn more' }).getAttribute('href')).toBe(
      '/help/minimap',
    );
  });
});

const PARTS = ['Centre Lines', 'Diagonals', 'Safe Area'];
const group = (onChange = vi.fn()): SettingsToggleGroupRow => ({
  kind: 'toggleGroup',
  key: 'guideParts',
  label: 'Guides Shown',
  description: 'Which guides draw while they are on.',
  toggles: PARTS.map((label) => ({
    key: label,
    label,
    value: label === 'Diagonals',
    onChange: (next: boolean) => onChange(label, next),
  })),
});

describe('SettingsToggleGroupRowView', () => {
  it('draws one group with a chip per switch, each showing its own state', () => {
    renderWithKit(<SettingsToggleGroupRowView row={group()} />);
    const g = screen.getByRole('group', { name: 'Guides Shown' });
    const switches = within(g).getAllByRole('switch');
    expect(switches.map((s) => s.textContent)).toEqual(PARTS);
    expect(switches.map((s) => s.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(g.getAttribute('aria-describedby')).toBe('guideParts-description');
  });

  it('flips the one switch pressed, and none while disabled', () => {
    const onChange = vi.fn();
    const { unmount } = renderWithKit(<SettingsToggleGroupRowView row={group(onChange)} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Safe Area' }));
    expect(onChange).toHaveBeenCalledWith('Safe Area', true);
    unmount();
    onChange.mockClear();
    renderWithKit(<SettingsToggleGroupRowView row={group(onChange)} disabled />);
    fireEvent.click(screen.getByRole('switch', { name: 'Safe Area' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SettingsChoiceRowView', () => {
  it('is a radio group, one option checked, and picks another', () => {
    const onChange = vi.fn();
    renderWithKit(
      <SettingsChoiceRowView
        row={{ key: 'size', label: 'Map Size', description: '' }}
        options={[
          { id: 'small', label: 'Small' },
          { id: 'large', label: 'Large', disabled: true },
        ]}
        value="small"
        onChange={onChange}
      />,
    );
    const radios = within(screen.getByRole('radiogroup', { name: 'Map Size' })).getAllByRole(
      'radio',
    );
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect((radios[1] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(radios[0]!);
    expect(onChange).toHaveBeenCalledWith('small');
  });
});

describe('link and note rows', () => {
  it('opens another category in place', () => {
    const open = vi.fn();
    renderWithKit(
      <SettingsLinkRowView
        row={{
          kind: 'link',
          key: 'toTokens',
          label: 'API Tokens',
          description: '',
          target: 'tokens',
          cta: 'Manage',
        }}
        onOpenCategory={open}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    expect(open).toHaveBeenCalledWith('tokens');
  });

  it('ends a sign-in note with the Sign In link', () => {
    renderWithKit(
      <SettingsNoteRowView
        row={{
          kind: 'note',
          key: 'emails',
          label: 'Emails',
          description: '',
          note: 'Sign in for emails.',
          signIn: true,
        }}
      />,
    );
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeTruthy();
  });
});
