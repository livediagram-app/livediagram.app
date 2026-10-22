// @vitest-environment jsdom

// The boundary's section (docs/specs/009-elements/boundary.md "The menu").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livedesign/document';
import { BoundaryMenuSection } from './BoundaryMenuSection';
import type { ElementStyleOps } from '@/lib/element-style-ops';

afterEach(cleanup);

const boundary = (over: Partial<ShapeElement> = {}) =>
  ({ ...createShape('boundary', 0, 0), ...over }) as ShapeElement;

function show(target: ShapeElement) {
  const ops: ElementStyleOps = {
    preview: vi.fn(),
    end: vi.fn(),
    commit: vi.fn(),
    burst: vi.fn(),
    commitTab: vi.fn(),
  };
  render(
    <BoundaryMenuSection
      target={target}
      ops={ops}
      sectionProps={() => ({ open: true, onToggle: () => {}, flush: true })}
    />,
  );
  const lastMap = () =>
    (ops.commit as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as (e: Element) => ShapeElement;
  return { ops, lastMap };
}

describe('BoundaryMenuSection', () => {
  it('turns the meta line on with words to type over, and off again', () => {
    const { ops, lastMap } = show(boundary());
    fireEvent.click(screen.getByRole('button', { name: /Meta Line/ }));
    expect(ops.commit).toHaveBeenCalledWith(expect.any(Function), 'BoundaryMeta');
    expect(lastMap()(boundary()).pageSubtitle).toBe('Meta line');
    cleanup();
    const second = show(boundary({ pageSubtitle: '10.0.0.0/16' }));
    fireEvent.click(screen.getByRole('button', { name: /Meta Line/ }));
    expect('pageSubtitle' in second.lastMap()(boundary({ pageSubtitle: 'x' }))).toBe(false);
  });

  it('picks a style, previewing it on hover', () => {
    const { ops, lastMap } = show(boundary());
    const inset = screen.getByRole('button', { name: 'Inset Style' });
    fireEvent.pointerEnter(inset, { pointerType: 'mouse' });
    expect(ops.preview).toHaveBeenCalled();
    fireEvent.click(inset);
    expect(ops.commit).toHaveBeenCalledWith(expect.any(Function), 'BoundaryStyle');
    expect(lastMap()(boundary()).boundaryStyle).toBe('inset');
  });
});
