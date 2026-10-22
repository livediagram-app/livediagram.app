// @vitest-environment jsdom

// The card's slots section (docs/specs/009-elements/card.md "Editing the slots").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livepages/document';
import { CardMenuSection } from './CardMenuSection';
import type { ElementStyleOps } from '@/lib/element-style-ops';

afterEach(cleanup);

const card = (over: Partial<ShapeElement> = {}) =>
  ({ ...createShape('card', 0, 0), ...over }) as ShapeElement;

function show(target: ShapeElement) {
  const ops: ElementStyleOps = {
    preview: vi.fn(),
    end: vi.fn(),
    commit: vi.fn(),
    burst: vi.fn(),
    commitTab: vi.fn(),
  };
  render(
    <CardMenuSection
      target={target}
      ops={ops}
      sectionProps={() => ({ open: true, onToggle: () => {}, flush: true })}
    />,
  );
  const lastMap = () =>
    (ops.commit as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as (e: Element) => ShapeElement;
  return { ops, lastMap };
}

describe('CardMenuSection', () => {
  it('turns the header band on', () => {
    const { ops, lastMap } = show(card());
    fireEvent.click(screen.getByRole('button', { name: /Header Band/ }));
    expect(ops.commit).toHaveBeenCalledWith(expect.any(Function), 'CardSlots');
    expect(lastMap()(card()).cardHeader).toBe(true);
  });

  it('turns the meta line off and the title back on with its starting words', () => {
    const { lastMap } = show(card());
    fireEvent.click(screen.getByRole('button', { name: /Meta Line/ }));
    expect('pageSubtitle' in lastMap()(card())).toBe(false);
    cleanup();
    const second = show(card({ pageTitle: undefined }));
    fireEvent.click(screen.getByRole('button', { name: /^Title/ }));
    expect(second.lastMap()(card({ pageTitle: undefined })).pageTitle).toBe('Title');
  });

  it('picks media from the tiles, None clearing it', () => {
    const { lastMap } = show(card());
    fireEvent.click(screen.getByRole('button', { name: 'Initial Media' }));
    expect(lastMap()(card()).cardMedia).toBe('initial');
    fireEvent.click(screen.getByRole('button', { name: 'No Media' }));
    expect('cardMedia' in lastMap()(card())).toBe(false);
  });
});
