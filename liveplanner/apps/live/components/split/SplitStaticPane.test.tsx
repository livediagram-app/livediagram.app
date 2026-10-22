// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { SPLIT_HOVER_FOCUS_MS } from '@/lib/split-view';
import { SplitStaticPane } from './SplitStaticPane';

vi.mock('@/app/project/[id]/EditorContext', () => ({
  useEditorContext: () => ({ editingId: null, userPreferences: {} }),
}));
vi.mock('./useTabSvg', () => ({
  useTabSvg: (t: Tab | undefined) =>
    t
      ? { markup: '<svg/>', width: 10, height: 10, origin: { x: 0, y: 0 }, background: '#fff' }
      : null,
}));
vi.mock('./TabSvgViewport', () => ({ TabSvgViewport: () => <div data-testid="drawing" /> }));

const tab = { id: 't2', name: 'Roadmap', elements: [] } as unknown as Tab;

function pane(
  props: {
    failed?: boolean;
    onFocus?: (via: 'Click' | 'Hover') => void;
    shown?: Tab;
    loaded?: boolean;
  } = {},
) {
  return render(
    <SplitStaticPane
      tab={props.shown ?? tab}
      loaded={props.loaded ?? false}
      failed={props.failed}
      initialAnchor={null}
      handleRef={{ current: null }}
      fitNonce={0}
      onFocus={props.onFocus ?? (() => {})}
    />,
  );
}

// docs/specs/007-editor/split-view.md "The other pane".
describe('SplitStaticPane', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    document.body.innerHTML = '';
  });

  it('says a tab that could not be fetched, rather than loading forever', () => {
    pane({ failed: true });
    expect(screen.getByText("Couldn't load Roadmap. Click to try again.")).toBeTruthy();
  });

  it('hands the editor over after resting, but never while text is being typed', () => {
    const onFocus = vi.fn();
    pane({ onFocus });
    const section = screen.getByRole('region');
    const field = document.body.appendChild(document.createElement('input'));
    field.focus();
    fireEvent.pointerEnter(section);
    act(() => void vi.advanceTimersByTime(SPLIT_HOVER_FOCUS_MS + 1));
    expect(onFocus).not.toHaveBeenCalled();
    field.blur();
    fireEvent.pointerLeave(section);
    fireEvent.pointerEnter(section);
    act(() => void vi.advanceTimersByTime(SPLIT_HOVER_FOCUS_MS + 1));
    expect(onFocus).toHaveBeenCalledWith('Hover');
  });

  // A Form tab always has its form: it is not "nothing on this tab".
  it('draws an empty Form tab, and says an empty canvas has nothing on it', () => {
    pane({ loaded: true, shown: { ...tab, kind: 'form', form: {} } as unknown as Tab });
    expect(screen.getByTestId('drawing')).toBeTruthy();
    cleanup();
    pane({ loaded: true });
    expect(screen.getByText('Nothing on this tab yet. Click to start on it.')).toBeTruthy();
  });
});
