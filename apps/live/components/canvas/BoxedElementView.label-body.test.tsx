// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement } from '@livediagram/document';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import { clearingInset } from '@/components/canvas/InsetContent';
import { ElementIndicatorStyleProvider } from '@/components/canvas/ElementIndicatorStyleContext';
import type { ElementIndicatorStyle } from '@/lib/element-indicator-style';

// docs/specs/008-canvas/canvas-and-palette.md "Shape primitives", through the real element view: a
// cylinder's label (and its editor) sits on the front of its body, under the lid and over the base,
// so a label of many lines grows down the body rather than up over the lid.

const cylinder = {
  ...createShape('cylinder', 0, 0),
  width: 100,
  height: 200,
  label: 'One\nTwo\nThree',
  textSize: 'md',
} as BoxedElement;

function draw(
  element: BoxedElement,
  { editing = false, style = 'off' }: { editing?: boolean; style?: ElementIndicatorStyle } = {},
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ElementIndicatorStyleProvider style={style}>{children}</ElementIndicatorStyleProvider>
  );
  return render(
    <BoxedElementView
      element={element}
      isSelected={editing}
      isEditing={editing}
      isPaintMode={false}
      showHandles={false}
      showAnchors={false}
      onBeginDrag={vi.fn()}
      onBeginEdit={vi.fn()}
      onCommitLabel={vi.fn()}
      onCommitTable={vi.fn()}
      onCancelEdit={vi.fn()}
      onFollowLink={vi.fn()}
      onOpenComments={vi.fn()}
      onOpenAction={vi.fn()}
      onOpenNote={vi.fn()}
      isoDepth={0}
      onSetPageHeading={vi.fn()}
      onContextSelect={vi.fn()}
      tabLocked={false}
      tabSummaries={[]}
      readOnly={false}
      remoteSelectors={[]}
    />,
    { wrapper },
  );
}

const band = (node: Element | null) => node?.closest<HTMLElement>('.inset-x-0') ?? null;

describe('a cylinder label', () => {
  it('sits on the body: from under the lid (27%) to over the base (97%)', () => {
    const { getByText } = draw(cylinder);
    const body = band(getByText(/One/));
    expect(body).not.toBeNull();
    expect(parseFloat(body!.style.top)).toBeCloseTo(54, 6);
    expect(parseFloat(body!.style.bottom)).toBeCloseTo(6, 6);
  });

  it('is edited in the same band, so editing moves no text', () => {
    const { container } = draw(cylinder, { editing: true });
    const body = band(container.querySelector('[contenteditable="true"]'));
    expect(body).not.toBeNull();
    expect(parseFloat(body!.style.top)).toBeCloseTo(54, 6);
  });

  it('clears both the lid and any indicator: the deepest inset on each side', () => {
    expect(clearingInset({ top: 30, bottom: 0 }, { top: 54, bottom: 6 })).toEqual({
      top: 54,
      bottom: 6,
    });
    expect(clearingInset({ top: 70, bottom: 12 }, { top: 54, bottom: 6 })).toEqual({
      top: 70,
      bottom: 12,
    });
    expect(clearingInset(undefined, { top: 0, bottom: 0 })).toEqual({ top: 0, bottom: 0 });
  });

  it('leaves a square its whole box', () => {
    const square = { ...createShape('square', 0, 0), label: 'Plain' } as BoxedElement;
    expect(band(draw(square).getByText('Plain'))).toBeNull();
  });
});
