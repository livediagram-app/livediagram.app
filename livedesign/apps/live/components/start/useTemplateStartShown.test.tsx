// @vitest-environment jsdom

// A new tab's first page waits for the start from its first frame (docs/specs/007-editor/start-diagramming.md "The
// first page"): the rule is read in render, never from the panel's own (lazily loaded) mount.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { dismissEmptyCard } from '@liveworkspace/workbench/components/canvas/empty-card-dismissed';
import { closeStartForBlank } from './close-start-for-blank';
import { useTemplateStartOpen, useTemplateStartShown } from './useTemplateStartShown';

type Ctx = {
  hydrated: boolean;
  zenMode: boolean;
  embedMode: boolean;
  pendingDraw: unknown;
  isReadOnly: boolean;
  activeTabConnected?: boolean;
  editorMode: { mode: string };
  activeTab: { id: string; elements: unknown[]; pages: unknown };
};
const fresh = (): Ctx => ({
  hydrated: true,
  zenMode: false,
  embedMode: false,
  pendingDraw: null,
  isReadOnly: false,
  editorMode: { mode: 'pages' },
  activeTab: { id: 't', elements: [], pages: undefined },
});
const ctx = vi.hoisted((): { value: Ctx } => ({ value: undefined as unknown as Ctx }));
vi.mock('@/app/design/[id]/EditorContext', () => ({ useEditorContext: () => ctx.value }));

afterEach(() => {
  ctx.value = fresh();
  localStorage.clear();
});
ctx.value = fresh();

describe('useTemplateStartShown', () => {
  it('is on for a fresh empty tab before any panel has mounted', () => {
    // No StartPanel has mounted, so the panel's own flag is still down: the canvas must not wait on it.
    expect(renderHook(() => useStartPanelOpen()).result.current).toBe(false);
    expect(renderHook(() => useTemplateStartShown()).result.current).toBe('pages');
    expect(renderHook(() => useTemplateStartOpen()).result.current).toBe(true);
  });

  it('is off once the tab has a chosen page, or for a Viewer', () => {
    ctx.value.activeTab = {
      id: 't',
      elements: [],
      pages: [{ id: 'p', orientation: 'portrait', kind: 'logo' }],
    };
    expect(renderHook(() => useTemplateStartShown()).result.current).toBeNull();
    ctx.value = fresh();
    ctx.value.isReadOnly = true;
    expect(renderHook(() => useTemplateStartShown()).result.current).toBeNull();
    expect(renderHook(() => useTemplateStartOpen()).result.current).toBe(false);
  });

  // A connected tab is empty but shows its own page (liveworkspace/docs/specs/004-index/connected-tabs.md).
  it('is off on a connected tab', () => {
    ctx.value.activeTabConnected = true;
    expect(renderHook(() => useTemplateStartShown()).result.current).toBeNull();
  });
});

// The × or an explicit blank closes the start for that tab, and its one page is drawn to ask its kind.
describe('useTemplateStartOpen', () => {
  it('is not open once the start is closed for that tab alone', () => {
    ctx.value.activeTab = { id: 'blank-tab', elements: [], pages: undefined };
    expect(renderHook(() => useTemplateStartOpen()).result.current).toBe(true);
    expect(closeStartForBlank('blank-tab', 'blank-logo')).toBe(true);
    expect(renderHook(() => useTemplateStartOpen()).result.current).toBe(false);
    expect(renderHook(() => useTemplateStartShown()).result.current).toBe('pages');
    ctx.value.activeTab = { id: 'other-tab', elements: [], pages: undefined };
    expect(renderHook(() => useTemplateStartOpen()).result.current).toBe(true);
  });

  it('follows the × on the tab', () => {
    const { result, rerender } = renderHook(() => useTemplateStartOpen());
    expect(result.current).toBe(true);
    dismissEmptyCard('t:pages');
    rerender();
    expect(result.current).toBe(false);
  });
});
