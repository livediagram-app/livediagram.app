// @vitest-environment jsdom

// A new tab's first page waits for the start from its first frame (docs/specs/007-editor/start-diagramming.md "Start
// Making Pages"): the rule is read in render, never from the panel's own (lazily loaded) mount.
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { closeStartForBlank } from './close-start-for-blank';
import {
  emptyCardShownOf,
  useTemplateStartOpen,
  useTemplateStartShown,
} from './useTemplateStartShown';

type Ctx = {
  hydrated: boolean;
  zenMode: boolean;
  embedMode: boolean;
  pendingDraw: unknown;
  isReadOnly: boolean;
  activeTabConnected?: boolean;
  activeTab: { id: string; elements: unknown[]; pages: unknown };
};
const ctx = vi.hoisted((): { value: Ctx } => ({
  value: {
    hydrated: true,
    zenMode: false,
    embedMode: false,
    pendingDraw: null,
    isReadOnly: false,
    activeTab: { id: 't', elements: [], pages: undefined },
  },
}));
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx.value }));

describe('useTemplateStartShown', () => {
  it('is on for a fresh empty tab before any panel has mounted', () => {
    expect(renderHook(() => useTemplateStartShown()).result.current).toBe(true);
  });

  it('is off once the tab has a chosen page, or for a Viewer', () => {
    ctx.value.activeTab = {
      id: 't',
      elements: [],
      pages: [{ id: 'p', orientation: 'landscape', kind: 'slide' }],
    };
    expect(renderHook(() => useTemplateStartShown()).result.current).toBe(false);
    ctx.value.activeTab = { id: 't', elements: [], pages: undefined };
    ctx.value.isReadOnly = true;
    expect(renderHook(() => useTemplateStartShown()).result.current).toBe(false);
    ctx.value.isReadOnly = false;
  });

  // A connected tab is empty but shows its own page (liveworkspace/docs/specs/004-index/connected-tabs.md).
  it('is off on a connected tab', () => {
    ctx.value.activeTabConnected = true;
    expect(renderHook(() => useTemplateStartShown()).result.current).toBe(false);
    ctx.value.activeTabConnected = false;
  });
});

// An explicit blank's start opens closed, its one page drawn to ask its kind ("Bringing it back").
describe('useTemplateStartOpen', () => {
  it('is open on a fresh empty tab, and not once the start is closed for that tab alone', () => {
    ctx.value.activeTab = { id: 'blank-tab', elements: [], pages: undefined };
    expect(renderHook(() => useTemplateStartOpen()).result.current).toBe(true);
    closeStartForBlank('blank-tab', 'blank');
    expect(renderHook(() => useTemplateStartOpen()).result.current).toBe(false);
    expect(renderHook(() => useTemplateStartShown()).result.current).toBe(true);
    ctx.value.activeTab = { id: 'other-tab', elements: [], pages: undefined };
    expect(renderHook(() => useTemplateStartOpen()).result.current).toBe(true);
  });
});

// A Participant's or Viewer's empty tab shows the empty-canvas card where an Editor's would show the start
// (liveworkspace/docs/specs/011-workbench/first-edit.md "The empty-canvas card").
describe('emptyCardShownOf', () => {
  const view = (over: Partial<Ctx> = {}) =>
    ({
      hydrated: true,
      zenMode: false,
      embedMode: false,
      pendingDraw: null,
      isReadOnly: true,
      activeTabConnected: false,
      activeTab: { id: 't', elements: [], pages: undefined },
      ...over,
    }) as unknown as Parameters<typeof emptyCardShownOf>[0];

  it('is on for a Participant or Viewer on an empty tab, never for an Editor (who sees the start)', () => {
    expect(emptyCardShownOf(view())).toBe(true);
    expect(emptyCardShownOf(view({ isReadOnly: false }))).toBe(false);
  });

  it('is off once the tab has a chosen page, in zen or an embed', () => {
    expect(
      emptyCardShownOf(
        view({
          activeTab: {
            id: 't',
            elements: [],
            pages: [{ id: 'p', orientation: 'landscape', kind: 'slide' }],
          },
        }),
      ),
    ).toBe(false);
    expect(emptyCardShownOf(view({ zenMode: true }))).toBe(false);
    expect(emptyCardShownOf(view({ embedMode: true }))).toBe(false);
  });
});
