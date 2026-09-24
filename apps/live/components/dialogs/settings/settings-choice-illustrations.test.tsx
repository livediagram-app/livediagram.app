// @vitest-environment jsdom
// Pick-one settings draw one picture per option (spec/148): Panel Layout and
// Theme. A drawing missing an option would leave that option with nothing to
// ring, and one drawn for an option that no longer exists would show a choice
// you can't make.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { CHOICE_ILLUSTRATIONS } from './settings-choice-illustrations';
import { SettingsIllustration } from './settings-illustrations';

afterEach(cleanup);

const ROWS = SETTINGS_CATEGORIES.flatMap((c) => c.rows);

describe('choice illustrations', () => {
  it('draws exactly the options of every illustrated choice row', () => {
    const illustrated = ROWS.filter(
      (r) => r.kind === 'choice' && r.illustration && r.illustration in CHOICE_ILLUSTRATIONS,
    );
    expect(illustrated.map((r) => r.key)).toContain('panelLayout');
    for (const row of illustrated) {
      if (row.kind !== 'choice' || !row.illustration) continue;
      const drawn = CHOICE_ILLUSTRATIONS[row.illustration as keyof typeof CHOICE_ILLUSTRATIONS];
      expect(
        drawn.states.map((s) => s.id),
        row.key,
      ).toEqual(row.options.map((o) => o.id));
      expect(
        drawn.states.map((s) => s.caption),
        row.key,
      ).toEqual(row.options.map((o) => o.label));
    }
  });

  it('draws the Theme row as light, dark and system', () => {
    const theme = ROWS.find((r) => r.key === 'appearance');
    expect(theme?.illustration).toBe('appearance');
    expect(CHOICE_ILLUSTRATIONS.appearance.states.map((s) => s.id).sort()).toEqual([
      'dark',
      'light',
      'system',
    ]);
  });

  it('rings the option in force, and only that one', () => {
    const { container } = render(<SettingsIllustration id="panelLayout" value="toolbar" />);
    const captions = [...container.querySelectorAll('text')];
    expect(captions.map((t) => t.textContent)).toEqual(['Floating', 'Minimal', 'Toolbar']);
    const current = captions.filter((t) => t.getAttribute('class')?.includes('font-semibold'));
    expect(current.map((t) => t.textContent)).toEqual(['Toolbar']);
  });

  it('describes the drawing for assistive tech', () => {
    const { container } = render(<SettingsIllustration id="appearance" value="dark" />);
    expect(container.querySelector('svg[role="img"]')?.getAttribute('aria-label')).toMatch(
      /light mode.*dark mode/,
    );
  });
});
