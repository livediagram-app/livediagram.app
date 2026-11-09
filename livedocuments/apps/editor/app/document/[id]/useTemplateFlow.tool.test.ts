// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedocuments/document';
import type { TemplateKind } from '@livedocuments/templates';
import { useTemplateFlow } from './useTemplateFlow';

// A tab with content opens on Select. A template that lands content makes the tab one, so the tool picked up for the
// empty tab is put down; Blank lands nothing and leaves it.

async function pick(
  kind: TemplateKind,
): Promise<{ putToolDown: ReturnType<typeof vi.fn>; requestFit: ReturnType<typeof vi.fn> }> {
  let tabs: Tab[] = [{ id: 't1', name: '', elements: [] }];
  const putToolDown = vi.fn();
  const requestFit = vi.fn();
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
      requestFit,
      putToolDown,
      markTabLoaded: vi.fn(),
    }),
  );
  await act(async () => {
    await result.current.chooseTemplate(kind);
  });
  return { putToolDown, requestFit };
}

describe('chooseTemplate and the tool in hand', () => {
  it('puts the tool down when a template lands its content', async () => {
    expect((await pick('event-poster')).putToolDown).toHaveBeenCalledOnce();
  });

  it('leaves the tool in hand on Blank, which lands nothing', async () => {
    expect((await pick('blank')).putToolDown).not.toHaveBeenCalled();
  });
});

// docs/specs/007-editor/pages-mode.md "Centred in the viewport": a blank of a page kind lands no elements but its own
// page, and is framed as it lands (Work Tracker #666: a slide on a phone opened framed for the A4 page it replaced).
describe('chooseTemplate and the frame', () => {
  it('frames a blank page kind, which lands a page but no elements', async () => {
    const { requestFit, putToolDown } = await pick('blank-slide-deck');
    expect(requestFit).toHaveBeenCalledOnce();
    expect(putToolDown).not.toHaveBeenCalled();
  });

  it('leaves the view where it is on Blank, which lands no page', async () => {
    expect((await pick('blank')).requestFit).not.toHaveBeenCalled();
  });
});
