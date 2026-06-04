'use client';

import { useEffect, useRef, useState } from 'react';
import type { Element } from '@livediagram/diagram';
import { apiAiMutate, apiAiReview, type AiMode } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

// Content rendered inside the MovablePanel wrapper in Canvas.tsx.
// Owns all AI interaction state (mode, prompt, response); the panel
// chrome (drag handle, collapse/minimize, reset position) is provided
// by MovablePanel so the AI surface looks and behaves consistently
// with every other floating panel in the editor.

type Props = {
  contextElements: Element[];
  tabName: string;
  ownerId: string;
  onApplyElements: (elements: Element[], mode: 'generate' | 'amend' | 'clean') => void;
};

const MODES: { id: AiMode; label: string }[] = [
  { id: 'generate', label: 'Generate' },
  { id: 'amend', label: 'Amend' },
  { id: 'clean', label: 'Clean' },
  { id: 'review', label: 'Review' },
];

const PLACEHOLDERS: Record<AiMode, string> = {
  generate: 'Describe what to add…',
  amend: 'Describe the changes…',
  clean: 'Any specific instructions, or leave blank for a full tidy-up…',
  review: 'Any specific focus, or leave blank for general feedback…',
};

type Status = 'idle' | 'loading' | 'done' | 'error';

export function AiPanelContent({ contextElements, tabName, ownerId, onApplyElements }: Props) {
  const [mode, setMode] = useState<AiMode>('generate');
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [reviewText, setReviewText] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const responseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [reviewText]);

  useEffect(() => {
    setReviewText('');
    setStatusMsg('');
    setStatus('idle');
  }, [mode]);

  const isLoading = status === 'loading';

  const handleSend = async () => {
    if (isLoading || ownerId === 'self') return;

    setStatus('loading');
    setStatusMsg('');
    setReviewText('');

    const payload = {
      mode,
      prompt: prompt.trim(),
      elements: contextElements as unknown[],
      tabName,
    };

    try {
      if (mode === 'review') {
        await apiAiReview(ownerId, payload, (chunk) => {
          setReviewText((t) => t + chunk);
        });
        track('AI', 'Used', 'Review');
        setStatus('done');
      } else {
        const elements = await apiAiMutate(ownerId, payload);
        track('AI', 'Used', mode === 'generate' ? 'Generate' : mode === 'amend' ? 'Amend' : 'Clean');
        onApplyElements(elements, mode);
        const count = elements.length;
        setStatusMsg(
          mode === 'generate'
            ? `Added ${count} element${count !== 1 ? 's' : ''}.`
            : 'Changes applied.',
        );
        setStatus('done');
        setPrompt('');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setStatusMsg(
        msg === 'off_topic'
          ? "I can only help with diagrams. Please describe a diagram change."
          : 'Something went wrong. Please try again.',
      );
      setStatus('error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSend();
    }
  };

  const showResponse = status !== 'idle' || reviewText.length > 0;

  return (
    <div className="flex flex-col">
      {/* Mode tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-100 px-2 py-1.5 dark:border-slate-800">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={
              mode === id
                ? 'rounded-md px-2.5 py-1 text-[11px] font-semibold bg-brand-500 text-white transition'
                : 'rounded-md px-2.5 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Response / status area */}
      {showResponse && (
        <div
          ref={responseRef}
          className="max-h-48 min-h-[3rem] overflow-y-auto px-3 py-2 text-[12px] leading-relaxed"
        >
          {mode === 'review' ? (
            <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
              {reviewText}
              {status === 'loading' && <BlinkCursor />}
            </p>
          ) : status === 'loading' ? (
            <p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Spinner />
              Thinking…
            </p>
          ) : (
            <p
              className={
                status === 'error'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-600 dark:text-slate-300'
              }
            >
              {status === 'done' && (
                <span className="mr-1 text-green-600 dark:text-green-400">✓</span>
              )}
              {statusMsg}
              {status === 'done' && (
                <span className="ml-1 text-slate-400 dark:text-slate-500">Press ⌘Z to undo.</span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Context hint */}
      <p className="px-3 pb-0.5 pt-1 text-[10px] text-slate-400 dark:text-slate-600">
        {contextElements.length === 0
          ? 'No elements on this tab.'
          : `Context: ${contextElements.length} element${contextElements.length !== 1 ? 's' : ''}`}
      </p>

      {/* Prompt + send */}
      <div className="flex gap-2 px-2 pb-2 pt-1">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDERS[mode]}
          rows={2}
          disabled={isLoading}
          className="min-w-0 flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-400 focus:ring-1 focus:ring-brand-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={isLoading || ownerId === 'self'}
          aria-label="Send"
          className="flex h-8 w-8 shrink-0 self-end items-center justify-center rounded-lg bg-brand-500 text-white transition hover:bg-brand-600 disabled:opacity-40"
        >
          {isLoading ? <Spinner small /> : <SendIcon />}
        </button>
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 8h12M9 3l5 5-5 5" />
    </svg>
  );
}

function Spinner({ small }: { small?: boolean }) {
  const size = small ? 12 : 14;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin" aria-hidden>
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

function BlinkCursor() {
  return <span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-slate-500 dark:bg-slate-400" aria-hidden />;
}
