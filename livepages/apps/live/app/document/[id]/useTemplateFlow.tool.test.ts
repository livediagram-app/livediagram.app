// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livepages/document';
import type { TemplateKind } from '@livepages/templates';
import { useTemplateFlow } from './useTemplateFlow';

// docs/specs/023-draw-mode/draw-mode.md "Opening tool": a tab with content opens on Select. A template that lands
// content makes the tab one, so the pen picked up for the empty tab is put down; Blank lands nothing and leaves it.

async function pick(kind: TemplateKind): Promise<ReturnType<typeof vi.fn>> {
  let tabs: Tab[] = [{ id: 't1', name: '', elements: [] }];
  const putToolDown = vi.fn();
  const { result } = renderHook(() =>
    useTemplateFlow({
      activeId: 't1',
      tabs,
      selfParticipant: { id: 'me', name: 'Me', color: '#000' } as never,
      documentName: 'Board',
      nameDocument: vi.fn(),
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
      putToolDown,
      markTabLoaded: vi.fn(),
      bringCardTypes: vi.fn(),
      seedCards: vi.fn(),
    }),
  );
  await act(async () => {
    await result.current.chooseTemplate(kind);
  });
  return putToolDown;
}

describe('chooseTemplate and the tool in hand', () => {
  it('puts the pen down when a Draw template lands its board', async () => {
    expect(await pick('comic-strip')).toHaveBeenCalledOnce();
  });

  it('leaves the tool in hand on Blank, which lands nothing', async () => {
    expect(await pick('blank')).not.toHaveBeenCalled();
  });
});
