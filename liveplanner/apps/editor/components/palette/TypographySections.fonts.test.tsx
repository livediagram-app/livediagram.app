// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLANNER_FONTS } from '@liveplanner/project';
import { TypographySections } from './TypographySections';

// docs/specs/004-interface-design/fonts.md "Not offered in liveplanner": an element's Font menu offers liveplanner's
// faces, never Permanent Marker.
afterEach(cleanup);

describe('TypographySections Font', () => {
  it('offers the faces liveplanner offers, and no others', () => {
    render(
      <TypographySections
        currentFont={null}
        currentSize="md"
        presetPx={() => 16}
        padding="md"
        onSetFont={vi.fn()}
        onSetSize={vi.fn()}
        onSetPadding={vi.fn()}
        sectionProps={(id) => ({ open: id === 'font', onToggle: vi.fn() })}
      />,
    );
    for (const f of PLANNER_FONTS) expect(screen.getByText(f.label)).toBeTruthy();
    expect(screen.queryByText('Permanent Marker')).toBeNull();
  });
});
