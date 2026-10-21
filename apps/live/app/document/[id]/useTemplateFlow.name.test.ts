// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/document';
import type { TemplateKind } from '@liveplanner/templates';
import { useTemplateFlow } from './useTemplateFlow';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// docs/specs/007-editor/templates-by-mode.md "The document's name": a template picked on the first tab names a
// document still on a default name after itself; a name someone gave it, or a later tab's template, never does.

async function pick(kind: TemplateKind, documentName: string, onTab = 't1') {
  let tabs: Tab[] = [
    { id: 't1', name: 'Tab 1', elements: [] },
    { id: 't2', name: 'Tab 2', elements: [] },
  ];
  const nameDocument = vi.fn();
  const { result } = renderHook(() =>
    useTemplateFlow({
      activeId: onTab,
      tabs,
      selfParticipant: { id: 'me', name: 'Me', color: '#000' } as never,
      documentName,
      nameDocument,
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
  return nameDocument;
}

describe('chooseTemplate names the document', () => {
  it('after the template, while its name is still a default one', async () => {
    expect(await pick('flowchart', 'Untitled document')).toHaveBeenCalledWith('Untitled Flowchart');
    // A mode's blank made by /new ("Untitled Plan") is a default name too.
    expect(await pick('sailboat', 'Untitled Plan')).toHaveBeenCalledWith(
      'Untitled Sailboat Retrospective',
    );
  });

  it('for a form template too', async () => {
    expect(await pick('rsvp-form', 'Untitled Plan')).toHaveBeenCalledWith(
      expect.stringMatching(/^Untitled .*Form$/),
    );
  });

  it('keeps a name someone gave it', async () => {
    expect(await pick('flowchart', 'Q3 roadmap')).not.toHaveBeenCalled();
  });

  it("leaves the document's name to its first tab", async () => {
    expect(await pick('flowchart', 'Untitled document', 't2')).not.toHaveBeenCalled();
  });

  it('does nothing when the name would not change', async () => {
    expect(await pick('flowchart', 'Untitled Flowchart')).not.toHaveBeenCalled();
  });
});
