// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { SPLIT_HOVER_FOCUS_MS } from '@/lib/split-view';
import { SplitStaticPane } from './SplitStaticPane';

vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorContext: () => ({ editingId: null, userPreferences: {} }),
}));
vi.mock('./useTabSvg', () => ({ useTabSvg: () => null }));

const tab = { id: 't2', name: 'Roadmap', elements: [] } as unknown as Tab;

function pane(props: { failed?: boolean; onFocus?: (via: 'Click' | 'Hover') => void } = {}) {
  return render(
    <SplitStaticPane
      tab={tab}
      loaded={false}
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
});
