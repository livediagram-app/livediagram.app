'use client';

import { useEffect, useRef, useState } from 'react';
import { AskIcon, BlinkCursor, CleanIcon, PlugIcon, SendIcon, Spinner } from './ai-panel-icons';
import type { Element } from '@livediagram/diagram';
import { apiAiStream, type AiMode, type AiConversationTurn } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { Tooltip } from '@/components/primitives/Tooltip';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

type AiPanelProps = {
  contextElements: Element[]; // all tab elements
  focusIds: string[]; // selected element IDs (empty = whole tab)
  // The conversation-reset key. The NAME below is payload only — keying
  // the reset on it wiped the conversation on every rename and leaked
  // history across two same-named tabs.
  tabId: string;
  tabName: string;
  ownerId: string;
  onApplyElements: (elements: Element[], mode: 'clean') => void;
  // Show the quick suggested-prompt chips (spec/25). Toggled from the AI
  // panel's settings popover; takes vertical space so it can be hidden.
  showSuggestions: boolean;
};

type ModeConfig = {
  id: AiMode;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
  suggestions: string[];
};

const MODES: ModeConfig[] = [
  {
    id: 'ask',
    label: 'Ask',
    tooltip: 'Ask a question about the selected elements or whole tab. Read-only.',
    icon: <AskIcon />,
    suggestions: [
      'How many steps are there?',
      'What are the decision points?',
      'Summarise this diagram',
      'What could go wrong?',
    ],
  },
  {
    id: 'clean',
    label: 'Clean',
    tooltip: 'Fix typos, normalise layout, sizes and styles.',
    icon: <CleanIcon />,
    suggestions: ['Fix spelling', 'Align and space evenly', 'Normalise colors', 'Improve layout'],
  },
];

const PLACEHOLDERS: Record<AiMode, string> = {
  clean: 'Any specific instructions, or leave blank…',
  ask: 'Ask a question about the diagram…',
};

type Status = 'idle' | 'loading' | 'done' | 'error';

const MAX_HISTORY = 6;

export function AiPanelContent({
  contextElements,
  focusIds,
  tabId,
  tabName,
  ownerId,
  onApplyElements,
  showSuggestions,
}: AiPanelProps) {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSend();
    }
  };

  const currentMode = MODES.find((m) => m.id === mode)!;
  const showResponse = status !== 'idle' || reviewText.length > 0;
  const contextLabel =
    focusIds.length > 0
      ? `${focusIds.length} selected element${focusIds.length !== 1 ? 's' : ''}`
      : contextElements.length === 0
        ? 'No elements'
        : `${contextElements.length} element${contextElements.length !== 1 ? 's' : ''} (whole tab)`;

  return (
    <div className="flex flex-col">
      {/* Mode tabs */}
      <div className="flex items-center justify-between gap-1 border-b border-slate-100 px-2 py-1.5 dark:border-slate-800">
        <div className="flex gap-0.5">
          {MODES.map((m) => (
            <Tooltip key={m.id} title={m.label} description={m.tooltip}>
              <button
                type="button"
                onClick={() => setMode(m.id)}
                className={
                  mode === m.id
                    ? 'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold bg-brand-500 text-white transition'
                    : 'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                }
              >
                {m.icon}
                {m.label}
              </button>
            </Tooltip>
          ))}
        </div>
        {/* Connect an external AI tool (MCP) — opens the help guide. */}
        <HelpArticleLink
          article="connectAiTool"
          variant="button"
          label="Connect agent"
          title="Connect an AI tool"
          description="Drive your diagrams from Claude, Cursor, and other AI tools over MCP."
          icon={<PlugIcon />}
          className="!gap-1 !px-2 !py-1 !text-[11px]"
        />
      </div>

      {/* Quick-action suggestion chips for the active mode */}
      {showSuggestions && currentMode.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pt-1.5 pb-1">
          {currentMode.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={isLoading}
              onClick={() => {
                setPrompt(s);
                void handleSend(s);
              }}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-brand-500/50 dark:hover:text-brand-400"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Response area */}
      {showResponse && (
        <div
          ref={responseRef}
          className="max-h-64 min-h-[4rem] overflow-y-auto px-3 py-2 text-[12px] leading-relaxed"
        >
          {mode === 'ask' ? (
            <div className="text-slate-700 dark:text-slate-300">
              <MarkdownText text={reviewText} />
              {status === 'loading' && <BlinkCursor />}
            </div>
          ) : status === 'loading' ? (
            <p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Spinner />
              {progressCount > 0
                ? `Generating… ${progressCount} element${progressCount !== 1 ? 's' : ''} so far`
                : 'Thinking…'}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {status === 'error' ? (
                <p className="text-red-600 dark:text-red-400">
                  {statusMsg || 'Something went wrong.'}
                </p>
              ) : (
                <>
                  {summary && <p className="text-slate-600 dark:text-slate-300">{summary}</p>}
                  <p className="text-slate-400 dark:text-slate-400">Press ⌘Z to undo.</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* History indicator */}
      {history.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-0.5">
          <span className="text-[10px] text-slate-400 dark:text-slate-400">
            {Math.floor(history.length / 2)} prior exchange{history.length > 2 ? 's' : ''} in
            context
          </span>
          <button
            type="button"
            onClick={() => setHistory([])}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            Clear context
          </button>
        </div>
      )}

      {/* Context hint */}
      <p className="px-3 pb-0.5 pt-0.5 text-[10px] text-slate-400 dark:text-slate-400">
        Context: {contextLabel}
      </p>

      {/* Prompt + send */}
      <div className="flex flex-col gap-1.5 px-2 pb-2 pt-1">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDERS[mode]}
          rows={3}
          disabled={isLoading}
          className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-400 focus:ring-1 focus:ring-brand-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={isLoading || ownerId === 'self'}
          aria-label="Send"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 py-1.5 text-[12px] font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {isLoading ? <Spinner small /> : <SendIcon />}
          {isLoading ? 'Thinking…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// ── Markdown renderer ────────────────────────────────────────────────
// Handles the subset the AI actually produces: **bold**, *italic*,
// - bullet lists, 1. numbered lists, and paragraph breaks.

function inlineFormat(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Split on **bold** and *italic* spans.
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[0].startsWith('**')) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else {
      parts.push(<em key={key++}>{match[3]}</em>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function MarkdownText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const Tag = listType === 'ol' ? 'ol' : 'ul';
    nodes.push(
      <Tag key={key++} className={listType === 'ol' ? 'ml-4 list-decimal' : 'ml-4 list-disc'}>
        {listItems}
      </Tag>,
    );
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    const ulMatch = line.match(/^[-*] (.+)/);
    const olMatch = line.match(/^\d+\. (.+)/);
    const h1Match = line.match(/^### (.+)/);
    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^# (.+)/);

    if (ulMatch) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listItems.push(<li key={key++}>{inlineFormat(ulMatch[1]!)}</li>);
    } else if (olMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listItems.push(<li key={key++}>{inlineFormat(olMatch[1]!)}</li>);
    } else {
      flushList();
      if (h1Match || h2Match || h3Match) {
        const content = (h1Match ?? h2Match ?? h3Match)![1]!;
        nodes.push(
          <p key={key++} className="font-semibold mt-1">
            {inlineFormat(content)}
          </p>,
        );
      } else if (line.trim() === '') {
        // blank line — paragraph gap handled by spacing on sibling <p>
      } else {
        nodes.push(
          <p key={key++} className="mt-1 first:mt-0">
            {inlineFormat(line)}
          </p>,
        );
      }
    }
  }
  flushList();
  return <>{nodes}</>;
}
