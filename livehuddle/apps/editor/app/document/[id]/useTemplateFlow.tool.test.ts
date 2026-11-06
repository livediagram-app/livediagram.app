// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livehuddle/document';
import type { TemplateKind } from '@livehuddle/templates';
import { useTemplateFlow } from './useTemplateFlow';

// docs/specs/023-draw-mode/draw-mode.md "Opening tool": a tab with content opens on Select. A template that lands
// content makes the tab one, so the pen picked up for the empty tab is put down; Blank lands nothing and leaves it.

async function pick(
  kind: TemplateKind,
  onLanded?: (tabId: string) => void,
): Promise<ReturnType<typeof vi.fn>> {
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
      onLanded,
    }),
  );
  await act(async () => {
    await result.current.chooseTemplate(kind);
  });
  return putToolDown;
}

describe('chooseTemplate and the tool in hand', () => {
  it('puts the tool down when a template lands its board', async () => {
    expect(await pick('team-pod')).toHaveBeenCalledOnce();
  });

  it('leaves the tool in hand on the blank, which lands nothing', async () => {
    expect(await pick('blank-session')).not.toHaveBeenCalled();
  });
});

// docs/specs/008-canvas/avatar-mode.md "Opening walking": a template landing is the tab's first content, so the tab is
// judged afresh for the walk; the blank lands nothing and leaves it be.
describe('chooseTemplate and opening walking', () => {
  it('asks for the tab to be judged afresh when a template lands its board', async () => {
    const onLanded = vi.fn();
    await pick('virtual-office', onLanded);
    expect(onLanded).toHaveBeenCalledExactlyOnceWith('t1');
  });

  it('asks nothing for the blank', async () => {
    const onLanded = vi.fn();
    await pick('blank-session', onLanded);
    expect(onLanded).not.toHaveBeenCalled();
  });
});
