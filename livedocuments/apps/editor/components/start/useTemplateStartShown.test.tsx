// @vitest-environment jsdom

// A new tab's first page waits for the start from its first frame (docs/specs/007-editor/start-diagramming.md "Start
// Making Pages"): the rule is read in render, never from the panel's own (lazily loaded) mount.
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTemplateStartShown } from './useTemplateStartShown';

type Ctx = {
  hydrated: boolean;
  zenMode: boolean;
  embedMode: boolean;
  pendingDraw: unknown;
  isReadOnly: boolean;
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
    ctx.value.activeTab = { id: 't', elements: [], pages: [{ id: 'p', orientation: 'landscape', kind: 'slide' }] };
    expect(renderHook(() => useTemplateStartShown()).result.current).toBe(false);
    ctx.value.activeTab = { id: 't', elements: [], pages: undefined };
    ctx.value.isReadOnly = true;
    expect(renderHook(() => useTemplateStartShown()).result.current).toBe(false);
  });
});
