'use client';

// Describe a Form (docs/specs/030-forms/describe-a-form.md): the person's words, up to 500 characters, three examples,
// the AI line, then Draft Form (or Ctrl / ⌘ Enter), Describe a Plan's words step shared (DescribePrompt). A draft turns
// the dialog to Check Your Form (the preview), where Create Form, the only press that makes anything, hands the draft
// and the chosen Responses Go To up. A refusal is said under the box in the api's fixed words, the text kept; the
// model's own words are never shown. A guest sees the sign-in nudge in the box's place.

import { useEffect, useRef, useState } from 'react';
import type { FormDraftResponse } from '@liveplanner/api-schema';
import {
  FORM_DRAFT_PER_DAY,
  FORM_DRAFT_PROMPT_MAX,
  type FormDefinition,
  type FormDraft,
} from '@liveplanner/forms';
import {
  firstFormDraftTarget,
  type FormDraftTarget,
  type FormDraftTargetOption,
} from '@liveplanner/templates';
import {
  Button,
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  SparkleIcon,
} from '@liveplanner/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import {
  DescribePrompt,
  DescribeSignIn,
  DescribeTitle,
  type DescribeExample,
} from '@/components/describe/DescribePrompt';
import { FormDraftRefusal } from './form-draft-client';
import { FormDraftPreview } from './FormDraftPreview';

export const DESCRIBE_FORM_EXAMPLES: readonly DescribeExample[] = [
  {
    label: 'Workshop Feedback',
    text: 'Feedback after a workshop: a 1 to 10 rating, what worked, what to change, which session they liked best and whether they would come again',
  },
  {
    label: 'Volunteer Sign-Up',
    text: 'Volunteers signing up for a charity fun run: name, email, phone, which shifts they can do, T-shirt size and any first aid training',
  },
  {
    label: 'Equipment Request',
    text: 'Staff asking for new equipment: what they need, why, how urgent it is, their team and the date they need it by',
  },
];

export const DESCRIBE_FORM_PLACEHOLDER =
  'An event RSVP asking for name, email, whether they’re coming, dietary needs and how many guests they’ll bring';
export const DESCRIBE_FORM_FAILED = 'That didn’t work. Check your connection and try again.';
export const DESCRIBE_FORM_SIGN_IN =
  'Sign in to describe a form in your own words. Your form stays as it is.';

const SUBTITLE =
  'Say what the form is for and what it should ask. You check the form before anything is made.';

export function DescribeFormDialog({
  signedIn,
  signInHref,
  draft,
  options,
  current,
  typeLabelFor,
  onCreate,
  onClose,
}: {
  // Describe a Form is for signed-in people only (describe-a-form.md "Who may"): a guest sees the nudge.
  signedIn: boolean;
  signInHref: string;
  // The api's Describe a Form, for the person's words.
  draft: (prompt: string) => Promise<FormDraftResponse>;
  // Responses Go To's choices, and where the tab's form sends responses now (chosen first).
  options: readonly FormDraftTargetOption[];
  current?: Pick<FormDefinition, 'destination' | 'sheet'> | undefined;
  // The name a new card type for this heading would take.
  typeLabelFor: (heading: string) => string;
  // Create Form: makes the form, answering why it couldn't (null: made).
  onCreate: (draft: FormDraft, target: FormDraftTarget) => string | null;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [checking, setChecking] = useState<FormDraft | null>(null);
  const [chosen, setChosen] = useState<string>('new-board');
  const [createSaid, setCreateSaid] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const heading = useRef<HTMLSpanElement>(null);
  // The ask in flight: a Cancel (or an unmount) makes its answer stale, and a stale answer is dropped.
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
    try {
      const drafted = await draft(prompt);
      if (mine !== asking.current) return;
      setCreateSaid(null);
      setChosen(firstFormDraftTarget(options, drafted.draft, current).id);
      setChecking(drafted.draft);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (error) {
      if (mine !== asking.current) return;
      setSaid(error instanceof FormDraftRefusal ? error.message : DESCRIBE_FORM_FAILED);
      box.current?.focus();
    } finally {
      if (mine === asking.current) setBusy(false);
    }
  };

  const cancel = () => {
    asking.current += 1;
    onClose();
  };

  const back = () => {
    setChecking(null);
    requestAnimationFrame(() => box.current?.focus());
  };

  const create = () => {
    const target = options.find((o) => o.id === chosen)?.target;
    if (!checking || !target) return;
    setCreateSaid(onCreate(checking, target));
  };

  return (
    <Dialog
      open
      onClose={cancel}
      ariaLabel={checking ? 'Check Your Form' : 'Describe a Form'}
      size="xl"
      phoneSheet
      className="flex max-h-[min(46rem,90dvh)] flex-col"
    >
      <DialogHeader
        title={
          <DescribeTitle ref={heading}>
            {checking ? 'Check Your Form' : 'Describe a Form'}
          </DescribeTitle>
        }
        subtitle={checking ? undefined : signedIn ? SUBTITLE : undefined}
      >
        <DialogCloseButton onClick={cancel} />
      </DialogHeader>
      {!signedIn ? (
        <DescribeSignIn>{DESCRIBE_FORM_SIGN_IN}</DescribeSignIn>
      ) : checking ? (
        <div
          data-describe-form-preview=""
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 max-sm:px-4"
        >
          <FormDraftPreview
            form={checking.form}
            options={options}
            chosen={chosen}
            onChoose={(id) => {
              setChosen(id);
              setCreateSaid(null);
            }}
            typeLabel={typeLabelFor(checking.form.heading)}
          />
        </div>
      ) : (
        <DescribePrompt
          ref={box}
          dataAttr="data-describe-form"
          label="Describe the form"
          text={text}
          onText={(t) => {
            setText(t);
            setSaid(null);
          }}
          max={FORM_DRAFT_PROMPT_MAX}
          placeholder={DESCRIBE_FORM_PLACEHOLDER}
          examples={DESCRIBE_FORM_EXAMPLES}
          busy={busy}
          said={said}
          note={<>Uses AI: plans and forms share {FORM_DRAFT_PER_DAY} drafts a day.</>}
          onSubmit={() => void submit()}
        />
      )}
      <DialogFooter>
        {!signedIn ? (
          <>
            <Button variant="secondary" size="sm" onClick={cancel}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => window.location.assign(signInHref)}>
              Sign In
            </Button>
          </>
        ) : checking ? (
          <>
            {createSaid ? (
              <span role="status" className="mr-auto text-[12px] text-rose-700 dark:text-rose-300">
                {createSaid}
              </span>
            ) : null}
            <Button variant="secondary" size="sm" onClick={back}>
              Back
            </Button>
            <Button variant="primary" size="sm" onClick={create}>
              Create Form
            </Button>
          </>
        ) : (
          <>
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
              {busy ? 'Drafting…' : 'Draft Form'}
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
