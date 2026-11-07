// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livehuddle/document';
import { BLANK_PAD_DROP } from '@livehuddle/templates';
import { useTemplateFlow } from './useTemplateFlow';

const track = vi.fn<(...args: unknown[]) => void>();
vi.mock('@/lib/telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/telemetry')>()),
  track: (...args: unknown[]) => track(...args),
}));

// docs/specs/009-elements/avatar-pad.md "Every Space and blank tab has one": Blank Space, and the start's ×, land the
// blank's Avatar Pad a little below the middle of the view; the tab stays blank, so the view, the selection and the
// tool in hand are left as they were. The × is not a pick: it counts no Template·Used.
async function chooseBlank(counted?: boolean) {
  let tabs: Tab[] = [{ id: 't1', name: 'Tab 1', elements: [] }];
  const requestFit = vi.fn();
  const putToolDown = vi.fn();
  const setSelectedId = vi.fn();
  const { result } = renderHook(() =>
    useTemplateFlow({
      activeId: 't1',
      tabs,
      selfParticipant: { id: 'me', name: 'Me', color: '#000' } as never,
      documentName: 'Untitled Space',
      nameDocument: vi.fn(),
      getViewportCenter: () => ({ x: 500, y: 300 }),
      commitTabs: (update) => {
        tabs = update(tabs);
      },
      confirmName: vi.fn(),
      setSelectedId,
      setEditingId: vi.fn(),
      setSelfParticipant: vi.fn(),
      setIdentityPromptOpen: vi.fn(),
      requestFit,
      putToolDown,
    }),
  );
  await act(async () => {
    await result.current.chooseTemplate(
      'blank-session',
      counted === undefined ? undefined : { counted },
    );
  });
  return { tab: tabs[0]!, requestFit, putToolDown, setSelectedId };
}

describe('choosing the blank', () => {
  beforeEach(() => track.mockClear());

  it('lands one Avatar Pad, centred across the view and below its middle', async () => {
    const { tab } = await chooseBlank();
    expect(tab.elements).toHaveLength(1);
    const pad = tab.elements[0] as {
      type: string;
      shape: string;
      x: number;
      y: number;
      width: number;
      height: number;
    };
    expect(pad.type).toBe('shape');
    expect(pad.shape).toBe('avatar-pad');
    expect(pad.x + pad.width / 2).toBe(500);
    expect(pad.y + pad.height / 2).toBe(300 + BLANK_PAD_DROP);
    expect(tab.templateChosen).toBe(true);
    // A blank names no tab after itself.
    expect(tab.name).toBe('Tab 1');
  });

  it('leaves the view, the selection and the tool in hand as they were', async () => {
    const { requestFit, putToolDown, setSelectedId } = await chooseBlank();
    expect(requestFit).not.toHaveBeenCalled();
    expect(putToolDown).not.toHaveBeenCalled();
    expect(setSelectedId).toHaveBeenLastCalledWith(null);
  });

  it('counts a pick, and not the start’s ×', async () => {
    await chooseBlank();
    expect(track).toHaveBeenCalledWith('Template', 'Used', expect.any(String));
    track.mockClear();
    const { tab } = await chooseBlank(false);
    expect(track).not.toHaveBeenCalledWith('Template', 'Used', expect.anything());
    expect(tab.elements).toHaveLength(1);
  });
});
