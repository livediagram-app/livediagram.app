// @vitest-environment jsdom
// The element menu's Live Status row (docs/specs/009-elements/live-status.md "The Live Status dialog"): the host hands
// the menu `onEditLiveStatus` only for an Editor, on a shape that takes a badge (not a self-drawing kind, not a
// locked shape), on a deployment that checks (`liveStatusEnabled`). Everyone else's menu never offers it.
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isSelfDrawingShape, type Element } from '@livediagram/document';

const state = vi.hoisted(() => ({
  liveStatusEnabled: true,
  level: 'edit' as 'edit' | 'participate' | 'view',
  isReadOnly: false,
  element: null as unknown,
  menuProps: [] as Record<string, unknown>[],
  readOnlyRenders: 0,
  setLiveStatusOpenForId: vi.fn(),
  closeContextMenu: vi.fn(),
}));

// Both lazy menus come through next/dynamic: record what the editor's menu is handed, and count the read-only one.
vi.mock('next/dynamic', () => ({
  default: (load: () => unknown) => {
    const readOnly = String(load).includes('ReadOnlyElementMenuHost');
    return function Lazy(props: Record<string, unknown>) {
      if (readOnly) state.readOnlyRenders++;
      else state.menuProps.push(props);
      return null;
    };
  },
}));
vi.mock('@/hooks/persistence/useCapabilities', () => ({
  useCapabilities: () => ({ liveStatusEnabled: state.liveStatusEnabled }),
}));
vi.mock('@liveworkspace/workbench/hooks/canvas/useSelectionStore', () => ({
  useSelectionOf: () => ({ selectedId: 's1', multiSelectedIds: new Set<string>() }),
}));
vi.mock('@/hooks/ui/useColourPalette', () => ({ useColourPalette: () => ({ swatches: [] }) }));
vi.mock('@/lib/telemetry', () => ({ track: () => {} }));
// Every other field the host reads is a handler it passes straight through: a no-op stands in for each.
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorContext: () => {
    const known: Record<string, unknown> = {
      contextMenu: { mode: 'element', elementId: 's1', x: 10, y: 10 },
      isReadOnly: state.isReadOnly,
      activeTab: { id: 't1', elements: [state.element] },
      can: { level: state.level },
      layers: [{ id: 'l1', name: 'Layer 1' }],
      tabs: [],
      userPreferences: {},
      sankey: {},
      flowchartActions: {},
      mindOutline: { canEdit: () => false, open: () => {} },
      setLiveStatusOpenForId: state.setLiveStatusOpenForId,
      closeContextMenu: state.closeContextMenu,
    };
    return new Proxy(known, { get: (t, k: string) => (k in t ? t[k] : () => {}) });
  },
}));

import { EditorContextMenuHost } from './EditorContextMenuHost';

const shape = (over: Record<string, unknown> = {}) =>
  ({
    id: 's1',
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    w: 120,
    h: 120,
    ...over,
  }) as unknown as Element;

const offered = () => {
  state.menuProps = [];
  render(<EditorContextMenuHost />);
  return state.menuProps.at(-1)?.onEditLiveStatus as ((id: string) => void) | undefined;
};

beforeEach(() => {
  state.liveStatusEnabled = true;
  state.level = 'edit';
  state.isReadOnly = false;
  state.element = shape();
  state.readOnlyRenders = 0;
  state.setLiveStatusOpenForId.mockClear();
  state.closeContextMenu.mockClear();
});

describe('EditorContextMenuHost: the Live Status row', () => {
  it('is offered to an Editor on a plain shape when the deployment checks, and opens the dialog', () => {
    const open = offered();
    expect(open).toBeTypeOf('function');
    open!('s1');
    expect(state.closeContextMenu).toHaveBeenCalled();
    expect(state.setLiveStatusOpenForId).toHaveBeenCalledWith('s1');
  });

  it('is not offered when the deployment does not check (polling off)', () => {
    state.liveStatusEnabled = false;
    expect(offered()).toBeUndefined();
  });

  it.each(['participate', 'view'] as const)('is not offered at the %s level', (level) => {
    state.level = level;
    expect(offered()).toBeUndefined();
  });

  it('is never reached by a read-only session: its menu is the read-only one', () => {
    state.isReadOnly = true;
    state.level = 'view';
    expect(offered()).toBeUndefined();
    expect(state.menuProps).toHaveLength(0);
    expect(state.readOnlyRenders).toBeGreaterThan(0);
  });

  it('is not offered on a locked shape', () => {
    state.element = shape({ locked: true });
    expect(offered()).toBeUndefined();
  });

  it.each(['progress-bar', 'bar-chart'])('is not offered on a self-drawing %s', (kind) => {
    expect(isSelfDrawingShape(kind)).toBe(true);
    state.element = shape({ shape: kind });
    expect(offered()).toBeUndefined();
  });

  it('is not offered on an element that is not a shape', () => {
    state.element = {
      id: 's1',
      type: 'arrow',
      from: { x: 0, y: 0 },
      to: { x: 10, y: 10 },
    };
    expect(offered()).toBeUndefined();
  });
});
