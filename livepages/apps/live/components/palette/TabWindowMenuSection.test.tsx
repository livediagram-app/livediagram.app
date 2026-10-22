// @vitest-environment jsdom
// A tab window's menu section (docs/specs/009-elements/tab-window.md "The menu").

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement, Tab } from '@livepages/document';

const editor = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => editor.value }));
vi.mock('@/app/document/[id]/useSelectTab', () => ({ useSelectTab: () => vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { TabWindowMenuSection } from './TabWindowMenuSection';

afterEach(cleanup);

const tabs = [
  { id: 'slides', name: 'Slides', elements: [] },
  { id: 'flow', name: 'Flow', elements: [] },
  { id: 'secret', name: 'Secret', elements: [] },
] as unknown as Tab[];
const win = (over: Partial<ShapeElement> = {}) =>
  ({
    id: 'w',
    type: 'shape',
    shape: 'tab-window',
    x: 0,
    y: 0,
    width: 640,
    height: 360,
    ...over,
  }) as ShapeElement;

function show(target: ShapeElement, ctx: Record<string, unknown> = {}) {
  editor.value = {
    tabs,
    activeTab: tabs[0],
    can: { level: 'edit' },
    activeTabLocked: false,
    isOutOfScope: () => false,
    ...ctx,
  };
  render(
    <TabWindowMenuSection
      target={target}
      ops={{ commit: vi.fn() } as never}
      sectionProps={() => ({ open: true, onToggle: () => {}, flush: false })}
    />,
  );
}

describe('TabWindowMenuSection', () => {
  it('names and offers no tab outside a tab-scoped link', () => {
    show(win({ windowTabId: 'secret' }), { isOutOfScope: (id: string) => id === 'secret' });
    expect(screen.queryByText(/Secret/)).toBeNull();
    expect(screen.getByText('Flow')).toBeTruthy();
  });

  it('offers no Open for a tab the window may not show', () => {
    show(win({ windowTabId: 'slides' }));
    expect(screen.queryByRole('menuitem', { name: /Open Slides/ })).toBeNull();
    expect(screen.queryByText('Open Slides')).toBeNull();
  });

  it('offers no choosing on a locked window', () => {
    show(win({ windowTabId: 'flow', locked: true }));
    expect(screen.queryByText('Shows')).toBeNull();
    expect(screen.getByText('Open Flow')).toBeTruthy();
  });
});
