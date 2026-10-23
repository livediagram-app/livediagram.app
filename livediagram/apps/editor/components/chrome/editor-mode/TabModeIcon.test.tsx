// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TabModeIcon } from './TabModeIcon';

// docs/specs/007-editor/editor-modes.md "The tab pill shows the tab's mode".
const markup = (tab: Parameters<typeof TabModeIcon>[0]['tab']) =>
  render(<TabModeIcon tab={tab} />).container.innerHTML;

describe('TabModeIcon', () => {
  it('gives each mode its own glyph', () => {
    const modes = (['diagram', 'draw', 'workshop'] as const).map((opensIn) =>
      markup({ id: opensIn, opensIn }),
    );
    expect(new Set(modes).size).toBe(3);
  });

  it('shows a former Plan tab as Diagram', () => {
    expect(markup({ id: 'p', opensIn: 'plan' as never })).toBe(
      markup({ id: 'd', opensIn: 'diagram' }),
    );
  });
});
