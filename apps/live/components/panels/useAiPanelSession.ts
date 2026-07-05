'use client';

// The AI panel's request session (spec/25), lifted out of AiPanel: the
// mode / prompt / streaming-status / conversation-history state, the
// per-mode and per-tab reset effects, and the streaming handleSend with
// its history bookkeeping + telemetry. AiPanel keeps the render.

import { useEffect, useRef, useState } from 'react';
import type { Element } from '@livediagram/diagram';
import { apiAiStream, type AiMode, type AiConversationTurn } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

type Status = 'idle' | 'loading' | 'done' | 'error';

const MAX_HISTORY = 6;

export function useAiPanelSession({
  contextElements,
  focusIds,
  tabId,
  tabName,
  ownerId,
  onApplyElements,
}: {
  contextElements: Element[];
  focusIds: string[];
  tabId: string;
  tabName: string;
  ownerId: string;
  onApplyElements: (elements: Element[], mode: 'clean') => void;
}) {
  const [mode, setMode] = useState<AiMode>('ask');
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [reviewText, setReviewText] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [progressCount, setProgressCount] = useState(0);
  const [summary, setSummary] = useState('');
  const [history, setHistory] = useState<AiConversationTurn[]>([]);
  const responseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [reviewText, statusMsg]);

  // Reset output when mode changes, keep history.
  useEffect(() => {
    setReviewText('');
    setStatusMsg('');
    setSummary('');
    setStatus('idle');
    setProgressCount(0);
  }, [mode]);

  // Clear all state including history when the active tab changes — the
  // previous tab's conversation is irrelevant to the new diagram. Keyed
  // on the tab ID, not the name (see AiPanelProps).
  useEffect(() => {
    setReviewText('');
    setStatusMsg('');
    setSummary('');
    setStatus('idle');
    setProgressCount(0);
    setHistory([]);
  }, [tabId]);

  const isLoading = status === 'loading';

  const handleSend = async (overridePrompt?: string) => {
    if (isLoading || ownerId === 'self') return;
    const finalPrompt = (overridePrompt ?? prompt).trim();

    setStatus('loading');
    setStatusMsg('');
    setReviewText('');
    setSummary('');
    setProgressCount(0);

    const userTurn: AiConversationTurn = { role: 'user', content: finalPrompt || `(${mode})` };

    const isTextMode = mode === 'ask';

    try {
      await apiAiStream(
        ownerId,
        {
          mode,
          prompt: finalPrompt,
          elements: contextElements as unknown[],
          focusIds,
          tabName,
          history,
        },
        {
          onTextChunk: (chunk) => setReviewText((t) => t + chunk),
          onProgress: (count) => setProgressCount(count),
          onDone: ({ elements, reviewText: rt, summary: s }) => {
            if (isTextMode) {
              setHistory((h) => [
                ...h.slice(-(MAX_HISTORY - 2)),
                userTurn,
                { role: 'assistant', content: rt },
              ]);
              track('AI', 'Used', 'Ask');
            } else {
              setHistory((h) => [
                ...h.slice(-(MAX_HISTORY - 2)),
                userTurn,
                { role: 'assistant', content: `Applied changes (${elements.length} elements)` },
              ]);
              track('AI', 'Used', 'Clean');
              onApplyElements(elements, 'clean');
              setSummary(s);
              setPrompt('');
            }
            setStatus('done');
          },
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), userTurn]);
      setStatusMsg(
        msg === 'off_topic'
          ? 'I can only help with diagrams. Please describe a diagram change.'
          : 'Something went wrong. Please try again.',
      );
      setStatus('error');
    }
  };

  return {
    mode,
    setMode,
    history,
    setHistory,
    prompt,
    setPrompt,
    status,
    reviewText,
    statusMsg,
    progressCount,
    summary,
    responseRef,
    isLoading,
    handleSend,
  };
}
