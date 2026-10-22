// @vitest-environment jsdom

// The AI panel's session (docs/specs/007-editor/ai-assistance.md): switching mode clears the output and
// keeps the conversation; switching tab clears both.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAiPanelSession } from './useAiPanelSession';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  apiAiStream: async (
    _owner: string,
    _payload: unknown,
    cb: {
      onTextChunk?: (t: string) => void;
      onDone: (r: {
        elements: never[];
        offTopic: boolean;
        reviewText: string;
        summary: string;
      }) => void;
    },
  ) => {
    cb.onTextChunk?.('Looks good');
    cb.onDone({ elements: [], offTopic: false, reviewText: 'Looks good', summary: '' });
  },
}));

function session(tabId = 't1') {
  return renderHook(
    (props: { tabId: string }) =>
      useAiPanelSession({
        contextElements: [],
        focusIds: [],
        tabId: props.tabId,
        tabName: 'Tab',
        ownerId: 'me',
        onApplyElements: vi.fn(),
      }),
    { initialProps: { tabId } },
  );
}

async function ask(result: { current: ReturnType<typeof useAiPanelSession> }) {
  await act(async () => result.current.handleSend('Any issues?'));
}

describe('useAiPanelSession', () => {
  it('answers into the output and the conversation', async () => {
    const { result } = session();
    await ask(result);
    expect(result.current.reviewText).toBe('Looks good');
    expect(result.current.status).toBe('done');
    expect(result.current.history).toHaveLength(2);
  });

  it('clears the output but keeps the conversation on a mode switch', async () => {
    const { result } = session();
    await ask(result);
    act(() => result.current.setMode('clean'));
    expect(result.current.reviewText).toBe('');
    expect(result.current.status).toBe('idle');
    expect(result.current.history).toHaveLength(2);
  });

  it('clears the output and the conversation on a tab switch', async () => {
    const { result, rerender } = session();
    await ask(result);
    rerender({ tabId: 't2' });
    expect(result.current.reviewText).toBe('');
    expect(result.current.status).toBe('idle');
    expect(result.current.history).toHaveLength(0);
  });
});
