'use client';

// Describe a Rule (docs/specs/026-plan/automations.md "Describe a Rule"): the person's words, up to 500 characters,
// three examples that fill the box, the AI cost line, then Draft Rule (or Ctrl / ⌘ Enter). While it drafts the box is
// read-only and the button busy; Cancel stops waiting (the ask still counts). A draft goes to `onDrafted` (the dialog
// opens it in the builder, unsaved and off); a refusal is said under the box in the api's fixed words, the text kept
// to change. The model's own words are never shown.

import { useEffect, useId, useRef, useState } from 'react';
import type { AutomationDraftResponse } from '@liveplanner/api-schema';
import { AI_DRAFT_PROMPT_MAX, AUTOMATION_AI_PER_DAY } from '@liveplanner/items';
import {
  Button,
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  SparkleIcon,
  TextArea,
} from '@liveplanner/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { AutomationRefusal } from './automations-client';
import { AiNote } from './step-panels/AiStepPanel';

export const DESCRIBE_EXAMPLES: readonly { label: string; text: string }[] = [
  {
    label: 'Stamp Done Cards',
    text: 'When a card moves to Done, set Completed On to today and remove the blocked label',
  },
  {
    label: 'Welcome Form Responses',
    text: 'When a form response comes in, comment “Thanks, we’ve got it” and set its priority to High',
  },
  {
    label: 'Nudge Overdue Cards',
    text: 'Every weekday at 9:00, flag overdue cards and email their assignee a reminder',
  },
];

export const DESCRIBE_PLACEHOLDER =
  'When a card moves to Done, set Completed On to today and remove the blocked label';
export const DESCRIBE_FAILED = 'That didn’t work. Check your connection and try again.';

export function DescribeRuleDialog({
  draft,
  onDrafted,
  onClose,
}: {
  // The api's Describe a Rule, for the person's words.
  draft: (prompt: string) => Promise<AutomationDraftResponse>;
  onDrafted: (drafted: AutomationDraftResponse) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  // The ask in flight: a Cancel (or an unmount) makes its answer stale, and a stale answer is dropped.
  const asking = useRef(0);
  const noteId = useId();
  const saidId = useId();
  const examplesId = useId();
  const prompt = text.trim();

  useEffect(() => {
    box.current?.focus();
    return () => {
      asking.current += 1;
    };
  }, []);

  const submit = async () => {
    if (!prompt || busy) return;
    const mine = ++asking.current;
    setBusy(true);
    setSaid(null);
    try {
      const drafted = await draft(prompt);
      if (mine === asking.current) onDrafted(drafted);
    } catch (error) {
      if (mine !== asking.current) return;
      setSaid(error instanceof AutomationRefusal ? error.message : DESCRIBE_FAILED);
      box.current?.focus();
    } finally {
      if (mine === asking.current) setBusy(false);
    }
  };

  const cancel = () => {
    asking.current += 1;
    onClose();
  };

  return (
    <Dialog open onClose={cancel} ariaLabel="Describe a Rule" size="xl" phoneSheet>
      <DialogHeader
        title={
          <span className="flex items-center gap-2">
            <SparkleIcon size={16} aria-hidden className="text-brand-700 dark:text-brand-300" />
            Describe a Rule
          </span>
        }
        subtitle="Say when the rule should run and what it should do. You check it before anything is saved."
      >
        <DialogCloseButton onClick={cancel} />
      </DialogHeader>
      <div data-describe-rule="" className="flex flex-col gap-3 px-6 py-5">
        <TextArea
          ref={box}
          aria-label="Describe the rule"
          aria-describedby={said ? `${saidId} ${noteId}` : noteId}
          aria-invalid={said ? true : undefined}
          rows={4}
          maxLength={AI_DRAFT_PROMPT_MAX}
          value={text}
          readOnly={busy}
          placeholder={DESCRIBE_PLACEHOLDER}
          onChange={(e) => {
            setText(e.target.value);
            setSaid(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          className="resize-none"
        />
        <div className="-mt-1 flex justify-end">
          <span
            aria-live="polite"
            className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400"
          >
            {text.length} / {AI_DRAFT_PROMPT_MAX}
          </span>
        </div>
        <div role="group" aria-labelledby={examplesId} className="flex flex-col gap-2">
          <span
            id={examplesId}
            className="text-[12px] font-medium text-slate-500 dark:text-slate-400"
          >
            Try an Example
          </span>
          <div className="flex flex-wrap gap-2">
            {DESCRIBE_EXAMPLES.map((e) => (
              <Button
                key={e.label}
                variant="secondary"
                size="xs"
                disabled={busy}
                title={e.text}
                onClick={() => {
                  setText(e.text);
                  setSaid(null);
                  box.current?.focus();
                }}
              >
                {e.label}
              </Button>
            ))}
          </div>
        </div>
        {said ? (
          <p
            id={saidId}
            role="alert"
            className="rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
          >
            {said}
          </p>
        ) : null}
        <AiNote id={noteId}>
          Uses AI: counts toward this plan&rsquo;s {AUTOMATION_AI_PER_DAY} AI steps a day.
        </AiNote>
      </div>
      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={cancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          busy={busy}
          disabled={!prompt}
          onClick={() => void submit()}
        >
          <SparkleIcon size={14} aria-hidden />
          {busy ? 'Drafting…' : 'Draft Rule'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
