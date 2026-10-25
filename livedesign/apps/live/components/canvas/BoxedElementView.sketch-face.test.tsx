// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement } from '@livedesign/design';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';

// docs/specs/008-canvas/finish.md "Every other face is drawn by hand too" and "Lettering", through the real element
// view: a face is split into its hand-drawn ink and its crisp words only under Sketch, and every word on an element
// wears the element's resolved face.

afterEach(cleanup);

function draw(element: BoxedElement, fontFamily?: string) {
  return render(
    <BoxedElementView
      element={element}
      fontFamily={fontFamily}
      isSelected={false}
      isEditing={false}
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
      onSetPageHeading={vi.fn()}
      onContextSelect={vi.fn()}
      tabLocked={false}
      tabSummaries={[]}
      readOnly={false}
      remoteSelectors={[]}
    />,
  );
}

const shape = (kind: string, finish?: string) =>
  ({
    ...createShape(kind as never, 0, 0),
    id: kind,
    ...(finish ? { finish } : {}),
  }) as BoxedElement;

describe('a sketched face', () => {
  it('splits a progress bar into its ink and its words under Sketch', () => {
    const { container } = draw(shape('progress-bar', 'sketch'));
    expect(container.querySelector('[data-sketch-ink]')).not.toBeNull();
    expect(container.querySelector('[data-sketch-words]')?.textContent).toContain('%');
  });

  it('leaves a progress bar whole in any other finish', () => {
    const { container } = draw(shape('progress-bar', 'professional'));
    expect(container.querySelector('[data-sketch-ink], [data-sketch-words]')).toBeNull();
  });

  it('leaves a plain box to its sketched body', () => {
    const { container } = draw(shape('square', 'sketch'));
    expect(container.querySelector('[data-sketch-ink]')).toBeNull();
  });
});

// docs/specs/008-canvas/finish.md "In WebKit": WebKit re-runs a live filter on every repaint, so there a face is not
// split and icons and stickers draw into still pictures. `GestureEvent` is how the view knows it is in WebKit.
describe('in WebKit', () => {
  afterEach(() => {
    delete (window as { GestureEvent?: unknown }).GestureEvent;
  });
  const inWebKit = () => {
    (window as { GestureEvent?: unknown }).GestureEvent = class {};
  };
  const liveWobble = (container: HTMLElement) =>
    container.querySelector('[style*="lvd-sketch-tile"]');

  it('draws a sketched face as it is, with no live wobble', () => {
    inWebKit();
    const { container } = draw(shape('progress-bar', 'sketch'));
    expect(container.querySelector('[data-sketch-ink], [data-sketch-words]')).toBeNull();
    expect(container.textContent).toContain('%');
  });

  it("draws a sketched icon's art into a still picture, not through a live filter", () => {
    inWebKit();
    const { container } = draw(shape('icon', 'sketch'));
    expect(container.querySelector('[data-sketch-art-picture]')).not.toBeNull();
    expect(liveWobble(container)).toBeNull();
  });

  it('keeps the live wobble on icons and the split on faces elsewhere', () => {
    expect(liveWobble(draw(shape('icon', 'sketch')).container)).not.toBeNull();
    cleanup();
    const { container } = draw(shape('progress-bar', 'sketch'));
    expect(container.querySelector('[data-sketch-ink]')).not.toBeNull();
  });
});

describe("an element's words", () => {
  it("are all in the element's face, so a face that writes its own wears it", () => {
    const { container } = draw(shape('stat-row'), "'Caveat', cursive");
    const wrapper = container.querySelector<HTMLElement>('[data-element-id="stat-row"]');
    expect(wrapper?.style.fontFamily).toContain('Caveat');
  });

  it('keep the editor default when nothing picks a face', () => {
    const { container } = draw(shape('stat-row'));
    expect(
      container.querySelector<HTMLElement>('[data-element-id="stat-row"]')?.style.fontFamily,
    ).toBe('');
  });
});
