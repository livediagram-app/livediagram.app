// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/document';
import type { TemplateKind } from '@livedesign/templates';
import { useTemplateFlow } from './useTemplateFlow';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// A template picked on the first tab names a document still on a default name after itself; a name someone
// gave it, or a later tab's template, never does.

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
    }),
  );
  await act(async () => {
    await result.current.chooseTemplate(kind);
  });
  return nameDocument;
}

describe('chooseTemplate names the document', () => {
  it('after the template, while its name is still a default one', async () => {
    expect(await pick('logo-design', 'Untitled document')).toHaveBeenCalledWith(
      'Untitled Logo Design',
    );
    // A design made by /new ("Untitled Mobile App Wireframe") is a default name too.
    expect(await pick('wireframe-website', 'Untitled Mobile App Wireframe')).toHaveBeenCalledWith(
      'Untitled Website Wireframe',
    );
  });

  it('keeps a name someone gave it', async () => {
    expect(await pick('logo-design', 'Q3 roadmap')).not.toHaveBeenCalled();
  });

  it("leaves the document's name to its first tab", async () => {
    expect(await pick('logo-design', 'Untitled document', 't2')).not.toHaveBeenCalled();
  });

  it('does nothing when the name would not change', async () => {
    expect(await pick('logo-design', 'Untitled Logo Design')).not.toHaveBeenCalled();
  });
});
