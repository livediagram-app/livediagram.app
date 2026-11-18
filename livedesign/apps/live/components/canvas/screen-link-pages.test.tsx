// @vitest-environment jsdom
import { memo } from 'react';
import { act, render, screen } from '@testing-library/react';
import { endImageCrop, startImageCrop } from '@liveworkspace/workbench/lib/image-crop-store';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type ElementLink, type Page } from '@livedesign/design';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { ScreenLinkPagesProvider, useScreenLinkMarker } from './screen-link-pages';

// docs/specs/007-editor/wireframe-pages.md "Setting a link": the link marker's line, its press, and that a page edit
// re-renders only the elements whose line changed.
const ME = 'a'.repeat(32);
const wire = (id: string, name?: string): Page => ({
  id,
  orientation: 'portrait',
  kind: 'wireframe',
  ...(name ? { name } : {}),
});
const el = (link: ElementLink | undefined, extra: Partial<Element> = {}): Element =>
  ({ ...createShape('square', 0, 0), id: 'el', link, ...extra }) as Element;

const renders = vi.fn();
let lastPress: (() => void) | undefined;
const Marker = memo(function Marker({ element }: { element: Element }) {
  renders(element.id);
  const marker = useScreenLinkMarker(element);
  lastPress = marker?.press;
  return (
    <p data-testid={element.id}>{marker ? `${marker.state}: ${marker.description}` : 'none'}</p>
  );
});

function mount(
  pages: Page[],
  element: Element,
  extra: { canLink?: (el: Element) => boolean } = {},
) {
  const focusPage = vi.fn();
  const pick = vi.fn();
  const tree = (p: Page[]) => (
    <ScreenLinkPagesProvider pages={p} focusPage={focusPage} pick={pick} canLink={extra.canLink}>
      <Marker element={element} />
    </ScreenLinkPagesProvider>
  );
  const view = render(tree(pages));
  return { focusPage, pick, rerender: (p: Page[]) => view.rerender(tree(p)) };
}

describe('useScreenLinkMarker', () => {
  it('names the screen, and a press brings it into view', () => {
    const { focusPage, pick } = mount(
      [wire('page-1'), wire('page-2', 'Checkout')],
      el({ kind: 'page', pageId: 'page-2' }),
    );
    expect(screen.getByTestId('el').textContent).toBe('page: Goes to Checkout');
    lastPress?.();
    expect(focusPage).toHaveBeenCalledWith('page-2');
    expect(pick).not.toHaveBeenCalled();
  });

  it('stands down while the element is being cropped, and comes back when the crop ends', () => {
    mount([wire('page-1'), wire('page-2', 'Checkout')], el({ kind: 'page', pageId: 'page-2' }));
    act(() => startImageCrop('el'));
    expect(screen.getByTestId('el').textContent).toBe('none');
    // Done, Cancel and Undo all end the crop through the one store.
    act(() => endImageCrop());
    expect(screen.getByTestId('el').textContent).toBe('page: Goes to Checkout');
    // Another image's crop leaves this marker alone.
    act(() => startImageCrop('other'));
    expect(screen.getByTestId('el').textContent).toBe('page: Goes to Checkout');
    act(() => endImageCrop());
  });

  it('reads a back link, whose press does nothing', () => {
    const { focusPage, pick } = mount([wire('page-1')], el({ kind: 'back' }));
    expect(screen.getByTestId('el').textContent).toBe('back: Goes back to the screen before');
    lastPress?.();
    expect(focusPage).not.toHaveBeenCalled();
    expect(pick).not.toHaveBeenCalled();
  });

  it('reads a deleted screen as broken: its press opens the Screen mode for whoever may link it', () => {
    const editor = resolveEditorCapabilities({ level: 'edit', adderKey: null });
    const viewer = resolveEditorCapabilities({ level: 'view', adderKey: ME });
    const participant = resolveEditorCapabilities({ level: 'participate', adderKey: ME });
    const broken = el({ kind: 'page', pageId: 'gone' });
    const a = mount([wire('page-1')], broken, { canLink: editor.linkScreens });
    expect(screen.getByTestId('el').textContent).toBe(
      'broken: Broken link: its screen was deleted',
    );
    lastPress?.();
    expect(a.pick).toHaveBeenCalledWith('el');
    expect(a.focusPage).not.toHaveBeenCalled();
    for (const can of [viewer, participant]) {
      document.body.innerHTML = '';
      const b = mount([wire('page-1')], broken, { canLink: can.linkScreens });
      lastPress?.();
      expect(b.pick).not.toHaveBeenCalled();
    }
    // A Participant's own element is its to mend.
    document.body.innerHTML = '';
    const own = mount([wire('page-1')], el({ kind: 'page', pageId: 'gone' }, { addedBy: ME }), {
      canLink: participant.linkScreens,
    });
    lastPress?.();
    expect(own.pick).toHaveBeenCalledWith('el');
  });

  it('is none for another link, no link, or outside a provider', () => {
    mount([wire('page-1')], el({ kind: 'url', url: 'https://x.test' }));
    expect(screen.getByTestId('el').textContent).toBe('none');
    document.body.innerHTML = '';
    mount([wire('page-1')], el(undefined));
    expect(screen.getByTestId('el').textContent).toBe('none');
    document.body.innerHTML = '';
    render(<Marker element={el({ kind: 'back' })} />);
    expect(screen.getByTestId('el').textContent).toBe('none');
  });

  it('re-renders a marker when its screen is renamed or deleted, and not for an unrelated page edit', () => {
    const link = el({ kind: 'page', pageId: 'page-2' });
    const { rerender } = mount([wire('page-1'), wire('page-2', 'Checkout')], link);
    renders.mockClear();
    // The pages laid out again, as every editor render does, and a page the link does not name renamed.
    rerender([wire('page-1', 'Home'), wire('page-2', 'Checkout')]);
    expect(renders).not.toHaveBeenCalled();
    rerender([wire('page-1', 'Home'), wire('page-2', 'Pay')]);
    expect(screen.getByTestId('el').textContent).toBe('page: Goes to Pay');
    rerender([wire('page-1', 'Home')]);
    expect(screen.getByTestId('el').textContent).toBe(
      'broken: Broken link: its screen was deleted',
    );
  });
});
