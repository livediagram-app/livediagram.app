'use client';

// A board's Form strip (docs/specs/030-forms/forms.md "On the board"): leading the board's widgets, one pill for each
// form sending its responses here, shown without anyone adding it: the form's name, whether it takes responses, the
// count (new ones marked), Copy Link (an Editor's, once published) and Open Form. It reads the count without marking
// anything seen: only opening the Form tab does. Short of room it gives way inside the header's padding, never under the
// top-right corner card (Work Tracker 1288): the name truncates first, and on a phone it leaves the name to the pill's
// accessible name and Open's tooltip, so the count and the buttons stay whole.
import { useState } from 'react';
import { CheckIcon, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideClipboardList, lucideCopy, lucideExternalLink } from '@liveworkspace/icons/lucide';
import { useFormLink } from '@/hooks/forms/useFormLink';
import { formUrlFor } from '@/lib/form-path';
import { track } from '@/lib/telemetry';
import type { PlanPalette } from '@/components/plan/plan-palette';
import { WIDGET_PILL_SHRINKS } from '@/components/plan/widgets/board-widget-parts';
import { useFormBoard, type FormBoardValue, type FormFeedingBoard } from './form-board-context';

const FormIcon = lucideGlyph(lucideClipboardList, 14);
const CopyIcon = lucideGlyph(lucideCopy, 13);
const OpenIcon = lucideGlyph(lucideExternalLink, 13);

export function FormBoardStrip({ palette }: { palette: PlanPalette }) {
  const board = useFormBoard();
  if (!board || board.forms.length === 0) return null;
  return (
    <span data-form-strip="" className="flex min-w-0 shrink items-center gap-1.5 pr-1.5">
      {board.forms.map((f) => (
        <FormPill key={f.tabId} form={f} board={board} palette={palette} />
      ))}
    </span>
  );
}

function FormPill({
  form,
  board,
  palette,
}: {
  form: FormFeedingBoard;
  board: FormBoardValue;
  palette: PlanPalette;
}) {
  const link = useFormLink({
    projectId: board.projectId,
    tabId: form.tabId,
    ownerId: board.ownerId,
    share: board.share,
    enabled: board.online && !!board.projectId,
    markSeen: false,
  });
  const [copied, setCopied] = useState(false);
  const live = link.link?.link ?? null;
  const responses = link.link?.responses ?? 0;
  const unseen = link.link?.unseen ?? 0;
  const state = !live ? 'Not Published' : live.open ? 'Accepting' : 'Closed';
  const dot = !live ? palette.muted : live.open ? '#10b981' : palette.muted;
  const url = live?.code ? formUrlFor(window.location.origin, live.code) : null;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const icon =
    'flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded transition hover:bg-black/5 dark:hover:bg-white/10';
  return (
    <span
      role="group"
      aria-label={`${form.heading} form`}
      className={`${WIDGET_PILL_SHRINKS} gap-1 pr-0.5`}
      style={{ borderColor: palette.border, background: palette.surface, color: palette.text }}
      onPointerDown={stop}
    >
      <FormIcon aria-hidden className="shrink-0" style={{ color: palette.muted }} />
      <span
        data-form-strip-name=""
        className="min-w-0 max-w-[10rem] truncate font-semibold phone:sr-only"
      >
        {form.heading}
      </span>
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
      <span className="sr-only">{state}.</span>
      <span data-form-strip-count="" className="min-w-0 truncate" style={{ color: palette.muted }}>
        {responses} {responses === 1 ? 'response' : 'responses'}
        {unseen ? <span className="font-semibold"> · {unseen} new</span> : null}
      </span>
      {url && board.canShare ? (
        <Tooltip label={copied ? 'Copied' : 'Copy Form Link'}>
          <button
            type="button"
            aria-label="Copy form link"
            className={icon}
            onClick={() => {
              void navigator.clipboard?.writeText(url).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
              track('Form', 'Shared', 'BoardCopy');
            }}
          >
            {copied ? <CheckIcon size={13} /> : <CopyIcon aria-hidden />}
          </button>
        </Tooltip>
      ) : null}
      <Tooltip label={`Open ${form.heading}`}>
        <button
          type="button"
          aria-label={`Open form ${form.heading}`}
          className={icon}
          onClick={() => board.openTab(form.tabId)}
        >
          <OpenIcon aria-hidden />
        </button>
      </Tooltip>
    </span>
  );
}
