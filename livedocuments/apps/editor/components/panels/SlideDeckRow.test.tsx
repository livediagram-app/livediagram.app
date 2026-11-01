// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Slide } from '@livedocuments/document';
import { SlideDeckRow } from './SlideDeckRow';

// docs/specs/012-collaboration/presentation-mode.md "Hidden slides": a hidden slide's row shows its name
// struck through, muted but still AA on the white panel.
afterEach(() => cleanup());

const row = (slide: Slide) =>
  render(
    <SlideDeckRow
      slide={slide}
      index={1}
      tabName="Deck"
      showTab={false}
      headline="Swapping one shift"
      isOpen={false}
      isDragging={false}
      renaming={false}
      thumb={undefined}
      roomy
      onOpen={vi.fn()}
      onRename={vi.fn()}
      onRenameDone={vi.fn()}
      menu={null}
      onPointerDown={vi.fn()}
      onPointerMove={vi.fn()}
      onPointerUp={vi.fn()}
    />,
  );

describe('SlideDeckRow', () => {
  it("strikes a hidden slide's name through in slate-500, never the 2.6:1 slate-400", () => {
    row({ id: 's', tabId: 't', elementIds: [], hidden: true });
    const name = screen.getByText('Swapping one shift');
    const light = name.className.split(/\s+/).filter((c) => !c.includes(':'));
    expect(light).toContain('line-through');
    expect(light).toContain('text-slate-500');
    expect(light).not.toContain('text-slate-400');
  });
});
