// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { templateTabs } from '@liveplanner/templates';
import { getTheme, recolourElementsForTheme } from '@/lib/themes';
import { useTemplateFlow } from './useTemplateFlow';

// docs/specs/007-editor/start-panel.md "The panel": a template picked from an empty tab's start panel
// (which picks no theme) lands in the tab's own theme, and leaves the tab's backdrop as it was.

const CENTRE = { x: 0, y: 0 };

async function land(tab: Tab): Promise<Tab> {
  let tabs: Tab[] = [tab];
  const { result } = renderHook(() =>
    useTemplateFlow({
      activeId: tab.id,
      tabs,
      selfParticipant: { id: 'me', name: 'Me', color: '#000' } as never,
      projectName: 'Q3 roadmap',
      nameProject: vi.fn(),
      getViewportCenter: () => CENTRE,
      commitTabs: (update) => {
        tabs = update(tabs);
      },
      confirmName: vi.fn(),
      setSelectedId: vi.fn(),
      setEditingId: vi.fn(),
      setSelfParticipant: vi.fn(),
      setIdentityPromptOpen: vi.fn(),
      requestFit: vi.fn(),
      putToolDown: vi.fn(),
      markTabLoaded: vi.fn(),
      bringCardTypes: vi.fn(),
      seedCards: vi.fn(),
    }),
  );
  await act(async () => {
    await result.current.chooseTemplate('task-tracker');
  });
  return tabs[0]!;
}

const strokes = (tab: Tab) =>
  tab.elements.map((e) => ('strokeColor' in e ? e.strokeColor : undefined));

describe('chooseTemplate theme', () => {
  const empty: Tab = {
    id: 't1',
    name: '',
    elements: [],
    theme: 'slate',
    backgroundColor: '#123456',
  };

  it("paints a start-panel pick in the tab's own theme", async () => {
    const landed = await land(empty);
    const expected = recolourElementsForTheme(
      templateTabs('task-tracker')[0]!.build(CENTRE.x, CENTRE.y),
      getTheme('slate'),
    );
    expect(strokes(landed)).toEqual(strokes({ ...empty, elements: expected }));
    expect(strokes(landed)).not.toEqual(
      strokes({ ...empty, elements: templateTabs('task-tracker')[0]!.build(0, 0) }),
    );
    // The backdrop stays the tab's: no theme was picked.
    expect(landed.theme).toBe('slate');
    expect(landed.backgroundColor).toBe('#123456');
  });

  it('leaves a tab that already has work on it untouched', async () => {
    const drawn: Tab = { ...empty, elements: templateTabs('kanban')[0]!.build(0, 0) };
    const landed = await land(drawn);
    expect(landed).toEqual(drawn);
  });
});
