// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PhotoLayersTab } from './PhotoLayersTab';
import { photoView } from './photo-view-test-utils';

// docs/specs/031-photo/photo-layers.md "The Layers tab": "Reordering ... works by touch too".
afterEach(() => cleanup());

const grips = () => Array.from(document.querySelectorAll<HTMLElement>('[data-layer-grip]'));

describe('the Layers tab on a touch screen', () => {
  it('gives every row a grip a finger drags without scrolling the list', () => {
    // A finger on the row itself scrolled the list (the system took the pointer), so a row never moved.
    const { view } = photoView();
    render(<PhotoLayersTab photo={view} onOpenAdjust={() => {}} others={() => []} />);
    expect(grips()).toHaveLength(2);
    for (const g of grips()) {
      expect(g.className).toContain('touch-none');
      expect(g.className).toContain('pointer-coarse:flex');
      expect(g.className).toContain('hidden');
      expect(g.closest('[role=option]')).toBeTruthy();
    }
  });

  it('shows no grip to someone who may not edit', () => {
    const { view } = photoView(undefined, undefined, { canEdit: false });
    render(<PhotoLayersTab photo={view} onOpenAdjust={() => {}} others={() => []} />);
    expect(grips()).toHaveLength(0);
  });
});
