'use client';

// A board's Form strip (docs/specs/030-forms/forms.md "On the board"): leading the board's widgets, one pill for each
// form sending its responses here, shown without anyone adding it: the form's name, whether it takes responses, the
// count (new ones marked), Copy Link (an Editor's, once published) and Open Form. It reads the count without marking
// anything seen: only opening the Form tab does. Short of room it gives way inside the header's padding, never under the
// top-right corner card (Work Tracker 1288): the name truncates first, and on a phone it leaves the name to the pill's
// accessible name and Open's tooltip, and the count stands alone ("0", the pill named "Request Form, 0 responses"), so
// the count and the buttons stay whole.
import { CheckIcon, lucideGlyph, useCopiedFlash } from '@liveplanner/ui';
import { lucideClipboardList, lucideCopy, lucideExternalLink } from '@liveworkspace/icons/lucide';
import { useFormLink } from '@/hooks/forms/useFormLink';
import { formUrlFor } from '@/lib/form-path';
import { track } from '@/lib/telemetry';
import type { PlanPalette } from '@/components/plan/plan-palette';
import {
  BoardStripButton,
  BoardStripPill,
  STRIP_LIVE_DOT,
} from '@/components/plan/widgets/BoardStripPill';
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
  const { copied, flash } = useCopiedFlash(1500);
  const live = link.link?.link ?? null;
  const responses = link.link?.responses ?? 0;
  const unseen = link.link?.unseen ?? 0;
  const counted = `${responses} ${responses === 1 ? 'response' : 'responses'}`;
  const state = !live ? 'Not Published' : live.open ? 'Accepting' : 'Closed';
  const dot = live?.open ? STRIP_LIVE_DOT : palette.muted;
  const url = live?.code ? formUrlFor(window.location.origin, live.code) : null;
  return (
    <BoardStripPill
      kind="form"
      // Named with its count, which a phone shows alone ("Request Form, 0 responses").
      label={`${form.heading}, ${counted}`}
      glyph={<FormIcon />}
      name={form.heading}
      dot={dot}
      state={state}
      palette={palette}
    >
      <span data-form-strip-count="" className="min-w-0 truncate" style={{ color: palette.muted }}>
        {responses}
        {/* On a phone the count stands alone (Work Tracker 1288): the word stays in the pill's name. */}
        <span className="phone:sr-only"> {responses === 1 ? 'response' : 'responses'}</span>
        {unseen ? <span className="font-semibold"> · {unseen} new</span> : null}
      </span>
      {url && board.canShare ? (
        <BoardStripButton
          tooltip={copied ? 'Copied' : 'Copy Form Link'}
          label="Copy form link"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(
              () => flash(),
              () => undefined,
            );
            track('Form', 'Shared', 'BoardCopy');
          }}
        >
          {copied ? <CheckIcon size={13} /> : <CopyIcon aria-hidden />}
        </BoardStripButton>
      ) : null}
      <BoardStripButton
        tooltip={`Open ${form.heading}`}
        label={`Open form ${form.heading}`}
        onClick={() => board.openTab(form.tabId)}
      >
        <OpenIcon aria-hidden />
      </BoardStripButton>
    </BoardStripPill>
  );
}
