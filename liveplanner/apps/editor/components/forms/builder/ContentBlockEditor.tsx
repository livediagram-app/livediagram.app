'use client';

// A selected content block's editing (docs/specs/030-forms/forms.md "Content blocks"): its kind (Text, Callout, Link
// Button, Picture) as chips, an optional heading, its text (web addresses become links), and what its kind holds: a
// callout's tone, a link's address and button words, a picture (chosen from FormImagePicker) with the text as its
// caption. Each change is one undo step a pause, as every builder field is.
import { useState } from 'react';
import {
  CALLOUT_TONES,
  CONTENT_BLOCKS,
  CONTENT_BLOCK_NAMES,
  CONTENT_TEXT_MAX,
  LINK_LABEL_MAX,
  LINK_URL_MAX,
  PROMPT_MAX,
  updateQuestion,
  type CalloutTone,
  type FormQuestion,
} from '@liveplanner/forms';
import { ChoiceChip } from './ChoiceChip';
import { DraftText, type DraftTextHandle } from './DraftText';
import { CONTENT_BLOCK_ICONS } from './question-icons';
import { useFormBuilder } from './form-builder-context';
import { FormImagePicker } from './FormImagePicker';
import { ContentBlockView } from '../ContentBlockView';

const TONE_NAMES: Readonly<Record<CalloutTone, string>> = {
  info: 'Info',
  tip: 'Tip',
  warning: 'Warning',
};

const FIELD =
  'rounded-md bg-slate-50 px-3 py-2 ring-[var(--form-accent)] focus-within:ring-2 dark:bg-slate-800/60';
const LABEL = 'mb-1.5 block text-[12px] font-semibold text-slate-500 dark:text-slate-400';

// A typed address as a link keeps it: https:// added to a bare host; null for anything that is not one.
export function linkAddress(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  if (!/^https:\/\//i.test(withScheme)) return null;
  try {
    return new URL(withScheme).hostname.includes('.') ? withScheme : null;
  } catch {
    return null;
  }
}

export function ContentBlockEditor({
  block: q,
  headingRef,
}: {
  block: FormQuestion;
  headingRef?: React.Ref<DraftTextHandle>;
}) {
  const b = useFormBuilder();
  const change = (patch: Partial<FormQuestion>) =>
    b.actions.changeForm((f) => updateQuestion(f, q.id, patch));
  const kind = q.block ?? 'text';
  const [urlDraft, setUrlDraft] = useState<string | null>(null);
  const [badUrl, setBadUrl] = useState(false);
  const [picking, setPicking] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Block" className="flex flex-wrap gap-1.5">
        {CONTENT_BLOCKS.map((k) => {
          const Icon = CONTENT_BLOCK_ICONS[k];
          return (
            <ChoiceChip
              key={k}
              radio
              on={kind === k}
              onClick={() =>
                change({
                  block: k,
                  tone: k === 'callout' ? (q.tone ?? 'info') : undefined,
                })
              }
            >
              <Icon aria-hidden size={14} />
              {CONTENT_BLOCK_NAMES[k]}
            </ChoiceChip>
          );
        })}
      </div>
      {kind === 'callout' ? (
        <div>
          <span className={LABEL}>Tone</span>
          <div role="radiogroup" aria-label="Tone" className="flex flex-wrap gap-1.5">
            {CALLOUT_TONES.map((t) => (
              <ChoiceChip
                key={t}
                radio
                small
                on={(q.tone ?? 'info') === t}
                onClick={() => change({ tone: t })}
              >
                {TONE_NAMES[t]}
              </ChoiceChip>
            ))}
          </div>
        </div>
      ) : null}
      {kind === 'image' ? (
        <div>
          <span className={LABEL}>Picture</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {q.imageId ? 'Change Picture' : 'Choose Picture'}
            </button>
            {q.imageId ? (
              <button
                type="button"
                onClick={() => change({ imageId: undefined })}
                className="h-9 cursor-pointer rounded-lg px-3 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                Remove Picture
              </button>
            ) : null}
          </div>
          {picking ? (
            <FormImagePicker
              title="Choose a Picture"
              onClose={() => setPicking(false)}
              onPick={(img) => {
                setPicking(false);
                change({ imageId: img.id });
              }}
            />
          ) : null}
        </div>
      ) : null}
      <div>
        <label className={LABEL}>
          {kind === 'image' ? 'Title (optional)' : 'Heading (optional)'}
        </label>
        <div className={FIELD}>
          <DraftText
            ref={headingRef}
            value={q.prompt}
            maxLength={PROMPT_MAX}
            label={kind === 'image' ? 'Picture title' : 'Heading'}
            placeholder={kind === 'callout' ? 'Good to know' : 'Heading'}
            className="text-[15px] font-semibold text-slate-900 dark:text-slate-50"
            onSave={(text) => change({ prompt: text.trim() })}
          />
        </div>
      </div>
      <div>
        <label className={LABEL}>{kind === 'image' ? 'Caption (optional)' : 'Text'}</label>
        <div className={FIELD}>
          <DraftText
            value={q.help ?? ''}
            maxLength={CONTENT_TEXT_MAX}
            multiline
            label={kind === 'image' ? 'Caption' : 'Text'}
            placeholder={
              kind === 'link'
                ? 'What they’ll find there (optional)'
                : 'Explain something. Web addresses become links.'
            }
            className="min-h-[3.5rem] text-[14px] leading-relaxed text-slate-700 dark:text-slate-200"
            onSave={(text) => change({ help: text.trim() || undefined })}
          />
        </div>
      </div>
      {kind === 'link' ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
          <div>
            <label htmlFor={`url-${q.id}`} className={LABEL}>
              Web Address
            </label>
            <input
              id={`url-${q.id}`}
              type="url"
              inputMode="url"
              maxLength={LINK_URL_MAX}
              placeholder="https://example.com/guide"
              value={urlDraft ?? q.url ?? ''}
              aria-invalid={badUrl || undefined}
              aria-describedby={badUrl ? `url-${q.id}-bad` : undefined}
              onChange={(e) => {
                setUrlDraft(e.target.value);
                setBadUrl(false);
              }}
              onBlur={() => {
                if (urlDraft === null) return;
                const url = linkAddress(urlDraft);
                if (urlDraft.trim() && !url) {
                  setBadUrl(true);
                  return;
                }
                setUrlDraft(null);
                change({ url: url ?? undefined });
              }}
              className={`h-10 w-full rounded-md border bg-white px-3 text-[14px] text-slate-900 outline-none focus:ring-2 focus:ring-[var(--form-accent)] dark:bg-slate-900 dark:text-slate-100 ${badUrl ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}
            />
            {badUrl ? (
              <p
                id={`url-${q.id}-bad`}
                className="mt-1 text-[12px] font-medium text-red-700 dark:text-red-400"
              >
                Enter a web address that starts https://
              </p>
            ) : null}
          </div>
          <div>
            <label className={LABEL}>Button Words</label>
            <div className={FIELD}>
              <DraftText
                value={q.linkLabel ?? ''}
                maxLength={LINK_LABEL_MAX}
                label="Button words"
                placeholder="Read the Guide"
                className="text-[14px] text-slate-800 dark:text-slate-100"
                onSave={(text) => change({ linkLabel: text.trim() || undefined })}
              />
            </div>
          </div>
        </div>
      ) : null}
      <div>
        <span className={LABEL}>As People See It</span>
        <div className="pointer-events-none" aria-hidden>
          <ContentBlockView block={q} />
        </div>
      </div>
    </div>
  );
}
