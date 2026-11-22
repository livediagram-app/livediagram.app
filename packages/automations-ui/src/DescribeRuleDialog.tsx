'use client';

// Describe a Rule (liveplanner/docs/specs/026-plan/automations.md "Describe a Rule"): the app's examples that fill the
// box, above it, then the person's words, up to 500 characters, the source line (which AI drafts it, and a way to add
// a key of their own), then Draft Rule (or Ctrl / ⌘ Enter). While it
// drafts the box is read-only and the button busy; Cancel stops waiting (the ask still counts). A draft goes to
// `onDrafted` (the dialog opens it in the builder, unsaved and off); a refusal is said under the box in the api's
// fixed words, the text kept to change. The model's own words are never shown.

import { useEffect, useRef, useState } from 'react';
import type { AiKeyFailure } from '@liveworkspace/ai/key-failure';
import { AI_DRAFT_PROMPT_MAX, AUTOMATION_AI_PER_DAY } from '@liveworkspace/automations';
import {
  Button,
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  SparkleIcon,
} from '@liveworkspace/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { WorkbenchAiSource } from '@liveworkspace/workbench/components/ai/WorkbenchAiSource';
import { AutomationRefusal } from './automations-client';
import { DescribePrompt } from './DescribePrompt';
import { useAutomationsKit } from './kit-context';
import type { RuleBody, RuleStart } from './types';

type Drafted = { rule: RuleBody; picks: RuleStart['picks'] };

export const DESCRIBE_FAILED = 'That didn’t work. Check your connection and try again.';

export function DescribeRuleDialog({
  draft,
  onDrafted,
  onClose,
}: {
  draft: (prompt: string) => Promise<Drafted>;
  onDrafted: (drafted: Drafted) => void;
  onClose: () => void;
}) {
  const kit = useAutomationsKit();
  const { examples, placeholder } = kit.describe;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  // A key that failed on the last ask, for the source line to say so and offer to fix it.
  const [keyFailure, setKeyFailure] = useState<AiKeyFailure | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  // The ask under way: an answer to one cancelled, or replaced, is dropped.
  const asking = useRef(0);
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
    setKeyFailure(null);
    try {
      const drafted = await draft(prompt);
      if (mine === asking.current) onDrafted(drafted);
    } catch (error) {
      if (mine !== asking.current) return;
      setSaid(error instanceof AutomationRefusal ? error.message : DESCRIBE_FAILED);
      setKeyFailure(error instanceof AutomationRefusal ? error.aiKey : null);
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
      <DescribePrompt
        ref={box}
        dataAttr="data-describe-rule"
        label="Describe the rule"
        text={text}
        onText={(t) => {
          setText(t);
          setSaid(null);
        }}
        max={AI_DRAFT_PROMPT_MAX}
        placeholder={placeholder}
        examples={examples}
        busy={busy}
        said={said}
        source={(id) => (
          <WorkbenchAiSource
            id={id}
            failure={keyFailure}
            allowance={`Counts toward this ${kit.plumbing.words.item}’s ${AUTOMATION_AI_PER_DAY} AI steps a day.`}
          />
        )}
        onSubmit={() => void submit()}
      />
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
