// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ToastActionSpec } from '@/hooks/ui/useToast';
import { receiveKnockOp } from './knock-inbox';
import { useMeetingPieces, type MeetingPiecesDeps } from './useMeetingPieces';

// docs/specs/012-collaboration/knock.md "Being knocked".

const actions: ToastActionSpec[] = [];
const toast = {
  action: (spec: ToastActionSpec) => actions.push(spec),
  dismissAction: () => {},
  info: () => {},
};
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('./knock-inbox', async (load) => ({
  ...(await load<typeof import('./knock-inbox')>()),
  playKnock: () => {},
}));

const pod = { id: 'pod', x0: 0, y0: 0, x1: 200, y1: 200, area: 40_000 };

function deps(over: Partial<MeetingPiecesDeps>): MeetingPiecesDeps {
  return {
    elements: [],
    zones: [pod],
    walkers: [],
    inMode: true,
    self: { x: 100, y: 100 },
    selfSeatedOn: null,
    doNotDisturb: false,
    ...over,
  };
}

const letIn = () =>
  actions
    .at(-1)!
    .actions.find((a) => a.label === 'Let In')!
    .onSelect();

describe('Let In', () => {
  it('stands you up when you sat down after the knock came', () => {
    actions.length = 0;
    const standUp = vi.fn();
    const send = vi.fn();
    const { rerender } = renderHook((d: MeetingPiecesDeps) => useMeetingPieces(d), {
      initialProps: deps({ standUp, send }),
    });
    receiveKnockOp('sam', { kind: 'avatar-knock', tabId: 't', roomId: 'pod' });
    rerender(deps({ standUp, send, selfSeatedOn: 'pod' }));
    letIn();
    expect(standUp).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'avatar-knock-answer', targetId: 'sam', answer: 'in' }),
    );
  });

  it('leaves you be when you stood up after the knock came', () => {
    actions.length = 0;
    const standUp = vi.fn();
    const { rerender } = renderHook((d: MeetingPiecesDeps) => useMeetingPieces(d), {
      initialProps: deps({ standUp, selfSeatedOn: 'pod' }),
    });
    receiveKnockOp('sam', { kind: 'avatar-knock', tabId: 't', roomId: 'pod' });
    rerender(deps({ standUp, selfSeatedOn: null }));
    letIn();
    expect(standUp).not.toHaveBeenCalled();
  });
});
