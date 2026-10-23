// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Participant } from '@/lib/identity';
import { useTemplateFlow } from './useTemplateFlow';

// The visitor name prompt (docs/specs/007-editor/new-design-route.md, IdentityPrompt): Join keeps the name typed,
// Cancel keeps the one they had; either confirms it and closes the prompt.

const me: Participant = { id: 'me', name: 'Ada', color: '#000', status: 'online' };

function flow() {
  const confirmName = vi.fn();
  const setSelfParticipant = vi.fn();
  const setIdentityPromptOpen = vi.fn();
  const { result } = renderHook(() =>
    useTemplateFlow({
      activeId: 't1',
      tabs: [{ id: 't1', name: '', elements: [] }],
      selfParticipant: me,
      designName: 'Q3 roadmap',
      nameDesign: vi.fn(),
      getViewportCenter: () => ({ x: 0, y: 0 }),
      commitTabs: vi.fn(),
      confirmName,
      setSelectedId: vi.fn(),
      setEditingId: vi.fn(),
      setSelfParticipant,
      setIdentityPromptOpen,
      requestFit: vi.fn(),
      putToolDown: vi.fn(),
      markTabLoaded: vi.fn(),
    }),
  );
  return { result, confirmName, setSelfParticipant, setIdentityPromptOpen };
}

describe('useTemplateFlow, the visitor name prompt', () => {
  it('Join takes a new name, confirms it and closes the prompt', () => {
    const { result, confirmName, setSelfParticipant, setIdentityPromptOpen } = flow();
    act(() => result.current.confirmIdentity('Grace'));
    expect(setSelfParticipant).toHaveBeenCalledTimes(1);
    const update = setSelfParticipant.mock.calls[0]![0] as (p: Participant) => Participant;
    expect(update(me).name).toBe('Grace');
    expect(confirmName).toHaveBeenCalledTimes(1);
    expect(setIdentityPromptOpen).toHaveBeenCalledWith(false);
  });

  it('Join with the same or an empty name keeps the participant as it is', () => {
    const { result, setSelfParticipant } = flow();
    act(() => result.current.confirmIdentity('Ada'));
    act(() => result.current.confirmIdentity(''));
    expect(setSelfParticipant).not.toHaveBeenCalled();
  });

  it('Cancel confirms the name they had and closes the prompt', () => {
    const { result, confirmName, setSelfParticipant, setIdentityPromptOpen } = flow();
    act(() => result.current.cancelIdentity());
    expect(setSelfParticipant).not.toHaveBeenCalled();
    expect(confirmName).toHaveBeenCalledTimes(1);
    expect(setIdentityPromptOpen).toHaveBeenCalledWith(false);
  });
});
