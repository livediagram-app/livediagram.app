// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, ShapeElement } from '@livedocuments/document';
import type { ElementStyleOps } from '@/lib/element-style-ops';
import { BuildTiles } from './BuildTiles';
import { AnimationSections, animationCategoriesOf } from './AnimationSections';

// docs/specs/012-collaboration/presentation-mode.md "Setting builds up": effect tiles, then Order; a first build takes
// the next step, None removes it, a step moves the selection to it, and New makes a step of its own.
const shape = (id: string, order?: number): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...(order ? { build: { order, effect: 'rise' as const } } : {}),
});

afterEach(cleanup);

function setup(target: ShapeElement, others: ShapeElement[]) {
  const commit = vi.fn();
  const ops = { commit } as unknown as ElementStyleOps;
  render(<BuildTiles selection={[target]} slideElements={[...others, target]} ops={ops} />);
  // What the last write does to the target.
  const wrote = () => {
    const [map, type] = commit.mock.calls.at(-1)! as [(el: Element) => Element, string];
    expect(type).toBe('Build');
    return (map(target) as ShapeElement).build;
  };
  return { commit, wrote };
}
const tile = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

describe('BuildTiles', () => {
  it('gives a first build the step after the slide’s last, with no Order until then', () => {
    const { wrote } = setup(shape('t'), [shape('a', 1), shape('b', 3)]);
    expect(screen.queryByText('Order')).toBeNull();
    fireEvent.click(tile('Fade'));
    expect(wrote()).toEqual({ order: 4, effect: 'fade' });
  });

  it('changes an effect in place, and None removes the build', () => {
    const { commit, wrote } = setup(shape('t', 1), [shape('a', 3)]);
    fireEvent.click(tile('Rise'));
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(tile('Appear'));
    expect(wrote()).toEqual({ order: 1, effect: 'appear' });
    fireEvent.click(tile('None'));
    expect(wrote()).toBeUndefined();
  });

  it('lists the slide’s steps by place and moves the selection to one', () => {
    const { wrote } = setup(shape('t', 1), [shape('a', 4), shape('b', 9)]);
    expect(screen.getByText('Order')).toBeTruthy();
    fireEvent.click(tile('Step 3'));
    expect(wrote()).toEqual({ order: 9, effect: 'rise' });
    fireEvent.click(tile('New Step'));
    expect(wrote()).toEqual({ order: 10, effect: 'rise' });
  });

  it('offers no New step to an element already alone at the last step', () => {
    setup(shape('t', 5), [shape('a', 1)]);
    expect(screen.queryByRole('button', { name: /New Step/ })).toBeNull();
    expect(tile('Step 2').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('animationCategoriesOf with builds', () => {
  it('adds Build last, only on a slide and never for an arrow alone', () => {
    expect(animationCategoriesOf([shape('t')], true)).toEqual(['shape', 'text', 'build']);
    expect(animationCategoriesOf([shape('t')])).toEqual(['shape', 'text']);
    const arrow = { id: 'x', type: 'arrow' } as unknown as Element;
    expect(animationCategoriesOf([arrow], true)).toEqual(['arrow']);
  });
});

describe('AnimationSections with a slide', () => {
  it('shows the Build section among the Animation row’s sections', () => {
    // The flyout measures itself; jsdom has no ResizeObserver.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const target = shape('t');
    const open = () => ({ open: true, onToggle: () => {} });
    render(
      <AnimationSections
        elements={[target]}
        keyPrefix=""
        sectionProps={open}
        flyoutProps={open}
        handlers={
          {
            build: { slideElements: [target] },
            elementStyle: { commit: vi.fn() },
          } as unknown as Parameters<typeof AnimationSections>[0]['handlers']
        }
      />,
    );
    expect(screen.getByText('Build')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Rise/ })).toBeTruthy();
  });
});
