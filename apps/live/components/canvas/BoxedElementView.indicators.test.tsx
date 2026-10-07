// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement } from '@livediagram/document';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import {
  ElementIndicatorStyleProvider,
  SuppressElementIndicators,
} from '@/components/canvas/ElementIndicatorStyleContext';
import type { ElementIndicatorStyle } from '@/lib/element-indicator-style';

// docs/specs/008-canvas/element-indicators.md, through the real element view: the indicators draw
// inside the element, the content moves out of their way, selection fades them, Off hides them.

const cloud = {
  ...createShape('cloud', 0, 0),
  width: 270,
  height: 180,
  label: 'Cloud',
  textSize: 'md',
  iconId: 'cloud',
  iconPosition: 'above',
  note: 'A note',
  link: { kind: 'url', url: 'https://example.com' },
  commentThread: {
    resolved: false,
    comments: [
      { id: '1', text: 'c', authorId: 'me', authorName: 'Me', authorColor: '#000', createdAt: 0 },
    ],
  },
} as BoxedElement;

function draw(
  element: BoxedElement,
  {
    selected = false,
    style = 'top',
    embed = false,
  }: { selected?: boolean; style?: ElementIndicatorStyle; embed?: boolean } = {},
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SuppressElementIndicators when={embed}>
      <ElementIndicatorStyleProvider style={style}>{children}</ElementIndicatorStyleProvider>
    </SuppressElementIndicators>
  );
  return render(
    <BoxedElementView
      element={element}
      isSelected={selected}
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

describe('BoxedElementView indicators', () => {
  it('draws the indicators along the top and moves the icon and label down', () => {
    const { container, getByText } = draw(cloud);
    const cluster = container.querySelector<HTMLElement>('[data-indicators="top"]')!;
    expect(cluster).not.toBeNull();
    expect(cluster.querySelectorAll('button')).toHaveLength(3);
    // The content area starts below the cluster.
    const moved = getByText('Cloud').closest<HTMLElement>('.inset-x-0')!;
    expect(parseFloat(moved.style.top)).toBeGreaterThan(0);
  });

  it('fades the indicators out while the element is selected', () => {
    const { container } = draw(cloud, { selected: true });
    const cluster = container.querySelector<HTMLElement>('[data-indicators]')!;
    expect(cluster.hasAttribute('inert')).toBe(true);
    expect(cluster.className).toContain('opacity-0');
  });

  it('draws none and moves nothing when indicators are off', () => {
    const { container, getByText } = draw(cloud, { style: 'off' });
    expect(container.querySelector('[data-indicators]')).toBeNull();
    expect(getByText('Cloud').closest('.inset-x-0')).toBeNull();
  });

  it('draws none in an embed, whatever style the person chose', () => {
    for (const style of ['top', 'footer'] as const) {
      const { container, getByText, unmount } = draw(cloud, { style, embed: true });
      expect(container.querySelector('[data-indicators]')).toBeNull();
      expect(getByText('Cloud').closest('.inset-x-0')).toBeNull();
      unmount();
    }
  });

  it('draws none on an element that carries nothing', () => {
    const plain = { ...createShape('square', 0, 0), label: 'Plain' } as BoxedElement;
    expect(draw(plain).container.querySelector('[data-indicators]')).toBeNull();
  });

  it('reads an icon with no side set as left of its label', () => {
    const box = {
      ...createShape('square', 0, 0),
      width: 260,
      height: 120,
      label: 'Box',
      textSize: 'md',
      iconId: 'star',
      note: 'n',
    } as BoxedElement;
    const { container, getByText } = draw(box);
    expect(container.querySelector('[data-indicators]')).not.toBeNull();
    expect(getByText('Box')).toBeTruthy();
  });

  it('draws indicators on a lane with an upright title', () => {
    const lane = {
      ...createShape('lane', 0, 0),
      width: 600,
      height: 200,
      label: 'Lane',
      titleOrientation: 'upright',
      padding: 'lg',
      note: 'n',
    } as BoxedElement;
    expect(draw(lane).container.querySelector('[data-indicators]')).not.toBeNull();
  });
});
