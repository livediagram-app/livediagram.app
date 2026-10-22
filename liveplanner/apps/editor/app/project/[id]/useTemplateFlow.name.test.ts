// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import type { TemplateKind } from '@liveplanner/templates';
import { useTemplateFlow } from './useTemplateFlow';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// docs/specs/007-editor/templates-by-mode.md "The project's name": a template picked on the first tab names a
// project still on a default name after itself; a name someone gave it, or a later tab's template, never does.

async function pick(kind: TemplateKind, projectName: string, onTab = 't1') {
  let tabs: Tab[] = [
    { id: 't1', name: 'Tab 1', elements: [] },
    { id: 't2', name: 'Tab 2', elements: [] },
  ];
  const nameProject = vi.fn();
  const { result } = renderHook(() =>
    useTemplateFlow({
      activeId: onTab,
      tabs,
      selfParticipant: { id: 'me', name: 'Me', color: '#000' } as never,
      projectName,
      nameProject,
      getViewportCenter: () => ({ x: 0, y: 0 }),
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
      startForm: vi.fn(),
    }),
  );
  await act(async () => {
    await result.current.chooseTemplate(kind);
  });
  return nameProject;
}

describe('chooseTemplate names the project', () => {
  it('after the template, while its name is still a default one', async () => {
    expect(await pick('kanban', 'Untitled project')).toHaveBeenCalledWith('Untitled Kanban Board');
    // A mode's blank made by /new ("Untitled Plan") is a default name too.
    expect(await pick('team-retro', 'Untitled Plan')).toHaveBeenCalledWith('Untitled Team Retro');
  });

  it('for a form template too', async () => {
    expect(await pick('rsvp-form', 'Untitled Plan')).toHaveBeenCalledWith(
      expect.stringMatching(/^Untitled .*Form$/),
    );
  });

  it('keeps a name someone gave it', async () => {
    expect(await pick('kanban', 'Q3 roadmap')).not.toHaveBeenCalled();
  });

  it("leaves the project's name to its first tab", async () => {
    expect(await pick('kanban', 'Untitled project', 't2')).not.toHaveBeenCalled();
  });

  it('does nothing when the name would not change', async () => {
    expect(await pick('kanban', 'Untitled Kanban Board')).not.toHaveBeenCalled();
  });
});
