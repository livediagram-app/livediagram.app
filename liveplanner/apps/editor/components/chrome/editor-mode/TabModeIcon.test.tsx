// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TabModeIcon } from './TabModeIcon';

// docs/specs/026-plan/plan-tabs.md "The kinds": a Plan kind's pill shows its kind, not the Plan mode.
const markup = (tab: Parameters<typeof TabModeIcon>[0]['tab']) =>
  render(<TabModeIcon tab={tab} />).container.innerHTML;

describe('TabModeIcon', () => {
  it('gives each Plan kind its own glyph, apart from the Plan mode’s', () => {
    const plan = markup({});
    const kinds = (['board', 'sheet', 'dashboard'] as const).map((kind) => markup({ kind }));
    expect(new Set([plan, ...kinds]).size).toBe(4);
  });
});
