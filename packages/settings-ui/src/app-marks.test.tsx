// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  appliesToEvery,
  markCount,
  marksWidth,
  SettingsAppMarksProvider,
  type SettingsAppMarks,
} from './app-marks';
import type { SettingsCategory, SettingsRow } from './model';
import { SettingsToggleRowView } from './rows/ToggleRow';
import { SettingsCategoryPane } from './SettingsCategoryPane';
import { renderWithKit } from './test/kit';

// The logos beside each row (liveworkspace/docs/specs/010-site/site.md "Settings", "Which apps a setting applies to").

const MARKS: SettingsAppMarks = {
  apps: [
    { id: 'a.app', name: 'livea', logo: <svg data-logo="a.app" /> },
    { id: 'b.app', name: 'liveb', logo: <svg data-logo="b.app" /> },
    { id: 'c.app', name: 'livec', logo: <svg data-logo="c.app" /> },
  ],
  every: <svg data-logo="all" />,
};

const toggle = (key: string, extra: Partial<SettingsRow> = {}): SettingsRow =>
  ({
    kind: 'toggle',
    key,
    label: key,
    description: `${key} description.`,
    value: false,
    onChange: vi.fn(),
    ...extra,
  }) as SettingsRow;

const draw = (rows: SettingsRow[], marks: SettingsAppMarks | null = MARKS) => {
  const category: SettingsCategory = { id: 'editor', label: 'Editor', rows };
  return renderWithKit(
    <SettingsAppMarksProvider value={marks}>
      <SettingsCategoryPane category={category} isMobile={false} />
    </SettingsAppMarksProvider>,
  );
};

const cell = (key: string) => document.querySelector<HTMLElement>(`[data-settings-cell="${key}"]`)!;

describe('app marks', () => {
  it('counts one mark for every app, else one per app, and sizes the column for the widest', () => {
    expect(appliesToEvery(['c.app', 'a.app', 'b.app'], MARKS)).toBe(true);
    expect(markCount(['a.app', 'b.app', 'c.app'], MARKS)).toBe(1);
    expect(markCount(['a.app', 'c.app'], MARKS)).toBe(2);
    expect(markCount(['elsewhere.app'], MARKS)).toBe(0);
    expect(marksWidth(0)).toBe(0);
    expect(marksWidth(2)).toBeGreaterThan(marksWidth(1));
  });

  it('names the apps a row applies to beside its name, in the panel’s order', () => {
    draw([
      toggle('mine', { apps: ['a.app'] }),
      toggle('two', { apps: ['c.app', 'a.app'] }),
      toggle('every', { apps: ['a.app', 'b.app', 'c.app'], allApps: true }),
    ]);
    expect(screen.getByRole('img', { name: 'Applies to livea' })).toBeTruthy();
    const two = screen.getByRole('img', { name: 'Applies to livea and livec' });
    expect([...two.querySelectorAll('[data-logo]')].map((l) => l.getAttribute('data-logo'))).toEqual(
      ['a.app', 'c.app'],
    );
    // Every app: liveworkspace's mark alone, and no "All apps" words beside it.
    const every = screen.getByRole('img', { name: 'Applies to every app' });
    expect(every.querySelector('[data-logo="all"]')).not.toBeNull();
    expect(cell('every').querySelector('[data-settings-all-apps]')).toBeNull();
    // Each name starts at the same place: every row's column is as wide as the widest cluster.
    const widths = ['mine', 'two', 'every'].map(
      (key) => (cell(key).querySelector('[data-settings-app-marks]')!.parentElement as HTMLElement).style.width,
    );
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBe(`${marksWidth(2)}px`);
  });

  it('leaves a nested row’s marks to its switch when they apply to the same apps, keeping the column', () => {
    draw([
      toggle('map', { apps: ['a.app', 'b.app'] }),
      toggle('size', { apps: ['b.app', 'a.app'], parent: 'map' }),
      toggle('dim', { apps: ['a.app'], parent: 'map' }),
    ]);
    expect(cell('size').querySelector('[data-settings-app-marks]')).toBeNull();
    expect(cell('size').querySelector('[data-settings-app-marks-spacer]')).not.toBeNull();
    expect(cell('dim').querySelector('[data-settings-app-marks]')?.getAttribute('aria-label')).toBe(
      'Applies to livea',
    );
  });

  it('draws no marks where one app is in play, and says "All apps" as before', () => {
    draw([toggle('shared', { apps: ['a.app'], allApps: true })], null);
    expect(document.querySelector('[data-settings-app-marks]')).toBeNull();
    expect(cell('shared').querySelector('[data-settings-all-apps]')).not.toBeNull();
  });
});

describe('a row that draws its own cell from its unfiled spec', () => {
  it('still draws its marks, matched by the key it had before the panel filed it', () => {
    renderWithKit(
      <SettingsAppMarksProvider value={MARKS}>
        <SettingsCategoryPane
          category={{
            id: 'a.app:appearance',
            label: 'Appearance',
            rows: [
              {
                kind: 'custom',
                key: 'a.app:theme',
                label: 'Theme',
                description: '',
                apps: ['a.app'],
                render: () => <SettingsToggleRowView row={{ key: 'theme', label: 'Theme', description: '' }} checked={false} onChange={() => {}} />,
              },
            ],
          }}
          isMobile={false}
        />
      </SettingsAppMarksProvider>,
    );
    expect(screen.getByRole('img', { name: 'Applies to livea' })).toBeTruthy();
  });
});
