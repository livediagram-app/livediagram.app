// @vitest-environment jsdom

// The Card section's Tag Colours (docs/specs/009-elements/tag-colours.md "Editing").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import { TagColoursBlock } from './TagColoursBlock';

afterEach(cleanup);

const card = (tags: string[]) =>
  ({ ...(createShape('card', 0, 0) as ShapeElement), tags }) as ShapeElement;

describe('TagColoursBlock', () => {
  it("lists the card's tags, and clears a mapped one", () => {
    const onSet = vi.fn();
    render(
      <TagColoursBlock
        target={card(['PCI', 'v2'])}
        tagColours={[{ tag: 'pci', color: '#d97706' }]}
        colourPalette={{ presets: [] }}
        onSetTagColour={onSet}
      />,
    );
    expect(screen.getByText('Tag Colours')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Clear v2 colour/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Clear PCI colour/ }));
    expect(onSet).toHaveBeenCalledWith('PCI', null);
  });

  it('shows nothing for a card with no tags', () => {
    const { container } = render(
      <TagColoursBlock
        target={card([])}
        tagColours={undefined}
        colourPalette={{ presets: [] }}
        onSetTagColour={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});
