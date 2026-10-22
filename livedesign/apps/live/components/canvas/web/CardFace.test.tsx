// @vitest-environment jsdom

// The card's face (docs/specs/009-elements/card.md): every slot it has switched on, the in-place lines that commit
// the title, the meta line and each tag, and the rule that they are inert until the card is selected.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement, type WebRows } from '@livedesign/document';

import { CardFace } from './CardFace';
import { TagColoursProvider } from '@/components/canvas/TagColoursContext';

afterEach(cleanup);

const card = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('card', 0, 0),
  ...over,
});

function renderCard(element: ShapeElement, editable = true) {
  const onSetRows = vi.fn<(rows: WebRows) => void>();
  const onSetHeading = vi.fn();
  render(
    <CardFace
      element={element}
      labelNode={<span>body label</span>}
      accent="#0284c7"
      fill="#ffffff"
      textColor="#0c4a6e"
      fontFamily={undefined}
      editable={editable}
      onSetRows={onSetRows}
      onSetHeading={onSetHeading}
    />,
  );
  return { onSetRows, onSetHeading };
}

function retype(name: string, text: string) {
  const line = screen.getByRole('textbox', { name });
  fireEvent.focus(line);
  line.textContent = text;
  fireEvent.keyDown(line, { key: 'Enter' });
  fireEvent.blur(line);
}

describe('CardFace', () => {
  it('draws the title, the meta line, the body and the tags', () => {
    renderCard(card());
    expect(screen.getByRole('textbox', { name: 'Card title' }).textContent).toBe('Payments');
    expect(screen.getByRole('textbox', { name: 'Card meta line' }).textContent).toBe(
      'Stripe, EU region',
    );
    expect(screen.getByText('body label')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Tag 2' }).textContent).toBe('v2');
  });

  it('commits a title and a tag through their own writes', () => {
    const { onSetHeading, onSetRows } = renderCard(card());
    retype('Card title', 'Billing');
    expect(onSetHeading).toHaveBeenCalledWith('pageTitle', 'Billing');
    retype('Tag 1', 'SOC2');
    expect(onSetRows).toHaveBeenCalledWith({ tags: ['SOC2', 'v2'] });
  });

  it('keeps its lines out of reach until the card is selected', () => {
    renderCard(card(), false);
    const title = screen.getByRole('textbox', { name: 'Card title' });
    expect(title.getAttribute('tabindex')).toBe('-1');
  });

  it('draws an initial from the title, and a badge "i" with no icon', () => {
    renderCard(card({ cardMedia: 'initial', pageTitle: 'ops lead' }));
    expect(screen.getByText('O')).toBeTruthy();
    cleanup();
    renderCard(card({ cardMedia: 'badge', iconId: undefined }));
    expect(screen.getByText('i')).toBeTruthy();
  });

  it('draws no slot that is switched off', () => {
    renderCard(card({ pageTitle: undefined, pageSubtitle: undefined, tags: undefined }));
    expect(screen.queryByRole('textbox', { name: 'Card title' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Tag 1' })).toBeNull();
  });

  it("tints a tag mapped in the tab's tag colours, and leaves the others (docs/specs/009-elements/tag-colours.md)", () => {
    render(
      <TagColoursProvider tab={{ tagColours: [{ tag: 'pci', color: '#d97706' }] }}>
        <CardFace
          element={card({ tags: ['PCI', 'v2'] })}
          labelNode={<span>body</span>}
          accent="#0284c7"
          fill="#ffffff"
          textColor="#0c4a6e"
          fontFamily={undefined}
          editable={false}
          onSetRows={vi.fn()}
          onSetHeading={vi.fn()}
        />
      </TagColoursProvider>,
    );
    const chips = [...document.querySelectorAll<HTMLElement>('[data-tag-colour]')];
    expect(chips).toHaveLength(1);
    expect(chips[0]!.style.borderColor).toBe('rgb(217, 119, 6)');
  });
});
