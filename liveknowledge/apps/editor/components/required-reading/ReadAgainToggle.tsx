'use client';

// Ask Everyone to Read Again (docs/specs/030-knowledgebase/required-reading.md "Where it shows"): while an Editor edits
// a Required Reading page, a small switch in the draft bar, left of Cancel, off by default. Save takes it
// (lib/required-reading/read-again.ts) and, when on, this registers who asks the api; leaving edit mode turns it
// off. A page drawn without the editor's store (the bar's own tests) shows none.
import { useContext, useEffect } from 'react';
import { HoverCard, Switch } from '@liveknowledge/ui';
import {
  EditorChromeContext,
  useEditorChrome,
  useEditorChromeStore,
} from '@/app/document/[id]/EditorContext';
import { useToast } from '@/hooks/ui/useToast';
import {
  registerReadAgainSender,
  setReadAgain,
  useReadAgain,
} from '@/lib/required-reading/read-again';
import { readingStore } from '@/lib/required-reading/reading-store';
import { readingFailureText } from '@/lib/required-reading/reading-words';
import { track } from '@/lib/telemetry';
import { useRequiredReading } from './useRequiredReading';

const PILL =
  'inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-white pl-2.5 pr-3.5 text-[13px] font-semibold text-slate-700 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200 lk-pop-in motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 phone:h-11 dark:bg-slate-800 dark:text-slate-200 dark:shadow-black/40 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-white';
const ON = 'ring-brand-300 text-brand-800 dark:ring-brand-400/50 dark:text-brand-100';

/** The switch itself, for its tests. */
export function ReadAgainSwitch({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <HoverCard
      title="Ask Everyone to Read Again"
      description="Saving clears every confirmation of this page, so everyone asked confirms again. Leave it off for a small fix."
    >
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Ask Everyone to Read Again"
        data-read-again={on ? 'on' : 'off'}
        onClick={() => onChange(!on)}
        className={`${PILL} ${on ? ON : ''}`}
      >
        <Switch presentational checked={on} size="xs" />
        <span className="phone:hidden">Ask Everyone to Read Again</span>
        <span className="hidden phone:inline">Read Again</span>
      </button>
    </HoverCard>
  );
}

function ConnectedReadAgain() {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const reading = useRequiredReading();
  const tab = useEditorChrome((s) => s.pageTab.id);
  const on = useReadAgain(tab);
  const offered =
    reading.shown && !!reading.entry.reading.required && reading.entry.reading.manages;
  // Who asks the api when Save takes it; leaving edit mode (this goes) turns it off.
  useEffect(() => {
    if (!offered) return;
    const release = registerReadAgainSender((page) => {
      const editor = chrome.get();
      if (!editor.documentId) return;
      track('UI', 'Used', 'ReadingAskedAgain');
      readingStore
        .again(
          { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode },
          editor.documentId,
          page,
        )
        .catch((err: unknown) => toast.error(readingFailureText(err, 'again')));
    });
    return () => {
      release();
      setReadAgain(tab, false);
    };
  }, [chrome, offered, tab, toast]);
  if (!offered) return null;
  return <ReadAgainSwitch on={on} onChange={(next) => setReadAgain(tab, next)} />;
}

export function ReadAgainToggle() {
  const store = useContext(EditorChromeContext);
  return store ? <ConnectedReadAgain /> : null;
}
