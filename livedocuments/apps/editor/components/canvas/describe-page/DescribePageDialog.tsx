'use client';

// Describe a Page (docs/specs/007-editor/describe-a-page.md "The dialog"): the Describe with AI family's dialog
// (Describe a Rule's words step, @liveworkspace/automations-ui DescribePrompt) for the next page of the tab, named for
// its kind (Describe a Slide, Describe a Card). The person's words, the source line (which AI makes it), then Make
// Slide (or Ctrl / ⌘ Enter). While it makes, the box is read-only and the button busy; after a while a quiet line says
// a thinking model can take a minute. Cancel, Escape or the close stop the request. A refusal is said under the box in
// the api's fixed words, the words kept to change; the model's own words are never shown. Its body keeps one height
// whatever it says, so the centred dialog never jumps.
import { useEffect, useId, useRef, useState } from 'react';
import type { AiKeyFailure } from '@liveworkspace/ai/key-failure';
import { ASK_BUILT_IN_PER_PERSON_PER_DAY } from '@liveworkspace/ask';
import { DescribePrompt } from '@liveworkspace/automations-ui/DescribePrompt';
import { Button, DialogFooter, SparkleIcon } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { WorkbenchAiSource } from '@liveworkspace/workbench/components/ai/WorkbenchAiSource';
import { PAGE_DRAFT_PROMPT_MAX } from '@livedocuments/api-schema';
import type { PageKind } from '@livedocuments/document';
import { PageDraftRefusal } from '@/lib/api/page-drafts';
import { DESCRIBE_PAGE_WORDS } from './describe-page-words';
import { describePageHeroArt } from './DescribePageHeroArt';

export const DESCRIBE_PAGE_FAILED = 'That didn’t work. Check your connection and try again.';
export const DESCRIBE_PAGE_NOT_ADDED =
  'The page couldn’t be added: the tab is locked, full, or now holds another kind of page.';
export const DESCRIBE_PAGE_SLOW =
  'Still working. A model that thinks first can take up to a minute.';
// When the slow line shows.
export const DESCRIBE_PAGE_SLOW_MS = 8_000;

/** Makes the page from the words: true once it is on the tab, false when it could not land. Rejects with a
 *  PageDraftRefusal for the api's refusals, anything else for a failure; an AbortError once cancelled. */
export type MakePage = (prompt: string, signal: AbortSignal) => Promise<boolean>;

export function DescribePageDialog({
  kind,
  make,
  onClose,
}: {
  kind: PageKind;
  make: MakePage;
  onClose: () => void;
}) {
  const words = DESCRIBE_PAGE_WORDS[kind];
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  // A key that failed on the last ask, for the source line to say so and offer to fix it.
  const [keyFailure, setKeyFailure] = useState<AiKeyFailure | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  // The ask under way, stopped by a cancel or when the dialog goes.
  const asking = useRef<AbortController | null>(null);
  const titleId = useId();
  const prompt = text.trim();
  useEffect(() => {
    box.current?.focus();
    return () => asking.current?.abort();
  }, []);
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setSlow(true), DESCRIBE_PAGE_SLOW_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [busy]);

  const submit = async () => {
    if (!prompt || busy) return;
    const controller = new AbortController();
    asking.current = controller;
    setBusy(true);
    setSaid(null);
    setKeyFailure(null);
    try {
      const made = await make(prompt, controller.signal);
      if (controller.signal.aborted) return;
      if (made) {
        onClose();
        return;
      }
      setSaid(DESCRIBE_PAGE_NOT_ADDED);
    } catch (error) {
      if (controller.signal.aborted) return;
      setKeyFailure(error instanceof PageDraftRefusal ? error.aiKey : null);
      setSaid(error instanceof PageDraftRefusal ? error.message : DESCRIBE_PAGE_FAILED);
      box.current?.focus();
    }
    setBusy(false);
  };
  const cancel = () => {
    asking.current?.abort();
    onClose();
  };

  return (
    <Dialog open onClose={cancel} titleId={titleId} size="xl" phoneSheet>
      <HeroDialogHeader
        art={describePageHeroArt}
        titleId={titleId}
        title={words.title}
        subtitle="Say what it is about and what it should say. AI picks a layout and writes it in."
        onClose={cancel}
        underHandle
      />
      {/* One height whatever is said under the box (a refusal, the slow line), so the centred dialog stays put. */}
      <div className="min-h-[352px] max-sm:min-h-0">
        <DescribePrompt
          ref={box}
          dataAttr="data-describe-page"
          label={words.title}
          text={text}
          onText={(t) => {
            setText(t);
            setSaid(null);
          }}
          max={PAGE_DRAFT_PROMPT_MAX}
          placeholder={words.placeholder}
          examples={words.examples}
          busy={busy}
          said={said}
          saidOnSource={keyFailure !== null}
          source={(id) => (
            <>
              {slow ? (
                <p
                  role="status"
                  data-describe-page-slow=""
                  className="text-[12px] text-slate-500 dark:text-slate-400"
                >
                  {DESCRIBE_PAGE_SLOW}
                </p>
              ) : null}
              <WorkbenchAiSource
                id={id}
                failure={keyFailure}
                allowance={`Counts toward your ${ASK_BUILT_IN_PER_PERSON_PER_DAY} built-in AI questions a day.`}
              />
            </>
          )}
          onSubmit={() => void submit()}
        />
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
          {busy ? 'Making…' : words.make}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
