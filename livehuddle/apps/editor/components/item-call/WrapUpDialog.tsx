'use client';

// Wrap Up, the host's after-call (docs/specs/012-collaboration/calls-from-items.md "Wrap Up"; the index's
// item-calls.md "After the call"): a summary drafted from the call's facts and the floors' notes, rewritten by AI on
// a press when the person has it, sent as a page to a chosen knowledgebase (the item's connected one, else its team's,
// first); and the stickies of the floor on show sent to a plan through Send to Plan, each card linked back to the item.
// Loaded on its first open.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { askSender, tabPassages } from '@liveworkspace/ask/ui';
import { ITEM_CALL_SUMMARY_MAX, type Item, type SpaceCall } from '@liveworkspace/index-client';
import { Button } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { meetingHeroArt } from '@liveworkspace/ui/dialog-hero-art/meeting';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import { sendAllStickies } from '@liveworkspace/workbench/components/send-to-plan/send-menu-item';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import type { Tab } from '@livehuddle/document';
import { useToast } from '@/hooks/ui/useToast';
import { track } from '@/lib/telemetry';
import { SUMMARY_QUESTION, summaryDraft, type NoteTab } from './wrap-up-notes';

type Kbs = { state: 'loading' } | { state: 'ready'; items: Item[] } | { state: 'failed' };

const FIELD =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function WrapUpDialog({
  call,
  spaceId,
  accountId,
  tabs,
  activeTabId,
  onClose,
  onSent,
}: {
  call: SpaceCall;
  spaceId: string;
  accountId: string;
  tabs: readonly Tab[];
  activeTabId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const titleId = useId();
  const summaryId = useId();
  const toast = useToast();
  const draft = useMemo(
    () => summaryDraft(call, call.names, tabs as unknown as readonly NoteTab[]),
    [call, tabs],
  );
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [kbs, setKbs] = useState<Kbs>({ state: 'loading' });
  const [kb, setKb] = useState<string>(call.summaryDefault?.id ?? '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ title: string; link: string } | null>(call.summary);
  const [writing, setWriting] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let live = true;
    indexClient
      .listItems({ app: 'liveknowledge', limit: 50 })
      .then(({ items }) => {
        if (!live) return;
        const editable = items.filter((i) => i.access === 'edit');
        setKbs({ state: 'ready', items: editable });
        setKb((now) => now || editable[0]?.id || '');
      })
      .catch(() => {
        if (live) setKbs({ state: 'failed' });
      });
    return () => {
      live = false;
      abort.current?.abort();
    };
  }, []);

  // The default knowledgebase is always offered, even past the list's first 50.
  const options = useMemo(() => {
    const items = kbs.state === 'ready' ? kbs.items : [];
    const d = call.summaryDefault;
    return d && !items.some((i) => i.id === d.id)
      ? [{ id: d.id, title: d.title }, ...items]
      : items;
  }, [kbs, call.summaryDefault]);

  const active = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const sendActions = active ? sendAllStickies(active.id, active.elements) : null;

  const writeWithAi = async () => {
    if (writing) return;
    setWriting(true);
    track('UI', 'Used', 'CallSummaryAi');
    const controller = new AbortController();
    abort.current = controller;
    let text = '';
    try {
      const passages = tabPassages(tabs);
      const outcome = await askSender(accountId)(
        { question: SUMMARY_QUESTION, passages },
        {
          signal: controller.signal,
          onDelta: (piece) => {
            text += piece;
            setBody(text);
          },
        },
      );
      if (outcome.type === 'done') setBody(outcome.text || text);
      else {
        setBody(body);
        toast.error(outcome.message);
      }
    } catch {
      // Closed while writing.
    } finally {
      setWriting(false);
    }
  };

  const sendSummary = async () => {
    if (!kb || sending) return;
    setSending(true);
    try {
      const { summary } = await indexClient.sendCallSummary(spaceId, {
        knowledgebase: kb,
        title: title.trim(),
        body,
      });
      track('UI', 'Created', 'CallSummary');
      setSent(summary);
      onSent();
    } catch {
      toast.error('The summary couldn’t be sent. Check you can edit that knowledgebase.');
    } finally {
      setSending(false);
    }
  };

  const ready =
    !!kb && title.trim() !== '' && body.trim() !== '' && body.length <= ITEM_CALL_SUMMARY_MAX;

  return (
    <Dialog open onClose={onClose} ariaLabel="Wrap Up" size="xl" className="max-h-[90vh]">
      <HeroDialogHeader
        art={meetingHeroArt}
        titleId={titleId}
        title="Wrap Up"
        subtitle={`The summary and actions of the call about ${call.item.title || 'the item'}.`}
        onClose={onClose}
      />
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className={FIELD}
          />
        </label>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label
              htmlFor={summaryId}
              className="text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              Summary
            </label>
            <Button variant="ghost" size="xs" busy={writing} onClick={() => void writeWithAi()}>
              Write With AI
            </Button>
          </div>
          <textarea
            id={summaryId}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            readOnly={writing}
            className={`${FIELD} font-mono text-xs leading-relaxed`}
          />
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Send To
          </span>
          <select
            value={kb}
            onChange={(e) => setKb(e.target.value)}
            disabled={kbs.state === 'loading'}
            className={FIELD}
          >
            {options.length === 0 ? (
              <option value="">
                {kbs.state === 'loading'
                  ? 'Finding knowledgebases…'
                  : 'No knowledgebase you can edit'}
              </option>
            ) : null}
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title || 'Untitled Knowledgebase'}
                {o.id === call.summaryDefault?.id ? ' (suggested)' : ''}
              </option>
            ))}
          </select>
        </label>
        {sent ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100">
            Sent as{' '}
            <a
              href={sent.link}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              {sent.title}
            </a>
            . The item’s Meetings link to it.
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="secondary" disabled={!sendActions} onClick={() => sendActions?.()}>
          Send Actions to Plan
        </Button>
        {sent ? (
          <Button variant="secondary" onClick={() => window.open(sent.link, '_blank', 'noopener')}>
            Open Page
          </Button>
        ) : null}
        <Button onClick={() => void sendSummary()} busy={sending} disabled={!ready}>
          {sent ? 'Send Again' : 'Send Summary'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
