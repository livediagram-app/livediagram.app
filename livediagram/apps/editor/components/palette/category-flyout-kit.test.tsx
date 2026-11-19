// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { flyoutKit, opensSide } from './category-flyout-kit';
import { paletteCategoriesFor } from './palette-layouts';
import { openerById } from './palette-openers';
import { tileById, type PaletteTileDef } from './palette-tile-defs';

// This editor's tiles as the shared category flyout draws them (docs/specs/007-editor/toolbar-layout.md "The
// category bar" and "Optional groups"); the flyout itself is workbench's, tested there.

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const tiles = (id: string): PaletteTileDef[] =>
  paletteCategoriesFor('diagram').find((c) => c.id === id)?.tiles ?? [];

describe('the flyout kit', () => {
  it('draws BPMN, and only BPMN, as an optional group: a header row over a closed, inert body', () => {
    const groups = flyoutKit('diagram').groups('shapes', tiles('shapes'));
    expect(groups.filter((g) => g.frame).map((g) => g.title)).toEqual(['BPMN']);
    const { container } = render(<>{groups.at(-1)!.frame!(<button data-flyout-item="" />)}</>);
    expect(container.querySelector('[data-optional-group="BPMN"]')).not.toBeNull();
    // Closed until opened, so the arrows skip its tiles (onFlyoutArrowKey).
    expect(container.querySelector('[inert] [data-flyout-item]')).not.toBeNull();
  });

  it('words a category’s line by the mode, one kit per mode', () => {
    expect(flyoutKit('workshop').tagline('write', 'fallback')).toBe(
      'Words, notes, tables and checklists.',
    );
    expect(flyoutKit('diagram').tagline('write', 'fallback')).toBe(
      'Words on the canvas: text, notes and comments.',
    );
    expect(flyoutKit('diagram')).toBe(flyoutKit('diagram'));
  });

  it('opens a side panel for presets and for an opener, and says what an opener browses', () => {
    const kit = flyoutKit('diagram');
    const opener = openerById('open:technology/aws')!;
    const plain = tileById('tools:text')!;
    expect(opensSide(plain)).toBe(false);
    expect(kit.footerLine?.(plain)).toBeUndefined();
    expect(opensSide(opener)).toBe(true);
    expect(kit.footerLine?.(opener)).toBe('Browse AWS.');
  });

  it('keeps My shapes’ padding inside the catalogue’s two panes', () => {
    const kit = flyoutKit('diagram');
    const { container, rerender } = render(<>{kit.catalogue(<p>mine</p>, 'my-shapes')}</>);
    expect(container.querySelector('.px-2 > p')).not.toBeNull();
    rerender(<>{kit.catalogue(<p>icons</p>, 'icons')}</>);
    expect(container.querySelector('.px-2')).toBeNull();
  });
});
