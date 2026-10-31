'use client';

// The item panel's layout pieces (docs/specs/026-plan/plan-board.md "The item panel"): the thin type-colour band at
// its top, a main-column section under its heading, a Details row (label beside its control), and the
// quiet created and edited lines at the foot of Details. ItemPanel arranges them; the field controls are
// ItemFieldEditor's.
import { FROM_FORM_FIELD, readFromForm } from '@liveplanner/forms';
import type { ReactNode } from 'react';
import { Tooltip, lucideGlyph, relativeSince } from '@liveplanner/ui';
import { lucideClipboardList } from '@liveworkspace/icons/lucide';
import {
  dayLabel,
  itemStampPerson,
  itemStampTime,
  stampDay,
  stampMomentLabel,
  type Item,
} from '@liveplanner/items';
import { PersonDisc } from './PersonDisc';
import { ACCENT_BG, accentVars } from './plan-palette';

// The day a card was made, as the panel gives it: "3 Oct 2026".
const stampDayLabel = (ms: number) => dayLabel(stampDay(ms), 'medium');

// The card type's colour as a thin band across the panel's top edge: the type shows without shouting. ACCENT_BG
// lifts a colour too dark to see on the dark chrome (Project's black), as the Card Types panel's stripes do.
export function ItemTypeBand({ colour }: { colour: string }) {
  return <div aria-hidden className={`h-1 shrink-0 ${ACCENT_BG}`} style={accentVars(colour)} />;
}

// A main-column field (or section) under its heading.
// A required field's mark after its name (docs/specs/026-plan/item-types.md "Required fields"): a red asterisk,
// read as "required".
export function RequiredMark() {
  return (
    <>
      <span aria-hidden className="ml-0.5 text-red-600 dark:text-red-400">
        *
      </span>
      <span className="sr-only"> required</span>
    </>
  );
}

export function ItemPanelSection({
  heading,
  htmlFor,
  required,
  actions,
  children,
}: {
  heading: string;
  // The control the heading labels, when it labels one.
  htmlFor?: string | undefined;
  required?: boolean;
  // What sits on the heading's own line after it (the Comments' open count and New Thread): one line, no row of
  // its own.
  actions?: ReactNode;
  children: ReactNode;
}) {
  const label = (
    <label
      htmlFor={htmlFor}
      className={`${actions ? 'shrink-0' : 'mb-2 block'} text-[13px] font-semibold text-slate-800 dark:text-slate-100`}
    >
      {heading}
      {required ? <RequiredMark /> : null}
    </label>
  );
  return (
    <section className="mb-8">
      {actions ? (
        <div className="mb-2 flex min-h-8 items-center gap-2">
          {label}
          {actions}
        </div>
      ) : (
        label
      )}
      {children}
    </section>
  );
}

// A Details row: a muted label beside its control on a wide screen (32 px rows; no hover highlight, the control itself shows it), above it in the
// phone's Details tab.
export function ItemDetailsRow({
  label,
  htmlFor,
  required,
  wide = false,
  children,
}: {
  label: string;
  htmlFor?: string | undefined;
  required?: boolean;
  // A maximised panel's wider Details (plan-board.md "Maximised"): an 8 rem label column.
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      // shrink-0: Details is a flex column of a fixed height (its footer pinned to the bottom), and a row allowed to
      // shrink was squeezed to its 36 px floor when the fields outgrew it, its control (a Time Spent field, Labels on
      // two lines) spilling over the rows below instead of Details scrolling.
      className={`-mx-2 grid min-h-9 shrink-0 ${wide ? 'grid-cols-[8rem_1fr]' : 'grid-cols-[6.5rem_1fr]'} items-center gap-2 rounded-lg px-2 py-1 max-sm:mx-0 max-sm:grid-cols-1 max-sm:items-start max-sm:gap-1.5 max-sm:px-0 max-sm:py-2`}
    >
      <label
        htmlFor={htmlFor}
        className="self-start pt-2 text-[12px] text-slate-500 max-sm:pt-0 max-sm:font-medium dark:text-slate-400"
      >
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      <div className="min-w-0 text-[13px]">{children}</div>
    </div>
  );
}

// Who made the card and who last edited it, and when: a quiet footer pinned to the bottom of Details (its parent is a
// flex column; docs/specs/026-plan/plan-board.md "Look", items.md "Created and Last Edited"), each row left out when
// the card holds no one for it, never a guess.
export function ItemMeta({ item, now }: { item: Item; now: number }) {
  const response = readFromForm(item.fields[FROM_FORM_FIELD]);
  const maker = itemStampPerson(item, 'createdBy');
  const made = itemStampTime(item, 'createdAt');
  const editor = itemStampPerson(item, 'updatedBy');
  const edited = itemStampTime(item, 'updatedAt');
  if (!maker && !response && !editor) return null;
  return (
    <footer
      data-item-meta=""
      className="mt-auto flex shrink-0 flex-col gap-0.5 pt-5 text-[12px] text-slate-500 dark:text-slate-400"
    >
      <div className="flex flex-col gap-0.5 border-t border-slate-200/80 pt-3 dark:border-slate-700/80">
        {maker ? (
          <MetaRow
            lead={<PersonDisc person={maker} />}
            // A form's response says when on its own row.
            at={response ? undefined : made}
            when={made !== undefined ? stampDayLabel(made) : ''}
          >
            Created by <span className={META_NAME}>{maker.name}</span>
          </MetaRow>
        ) : null}
        {response ? (
          // A form's response (docs/specs/030-forms/forms.md "What a response makes"): its number and when it came.
          <MetaRow
            lead={<FormGlyph aria-hidden />}
            at={made}
            when={made !== undefined ? stampDayLabel(made) : ''}
          >
            Form response <span className={META_NAME}>#{response.number}</span>
          </MetaRow>
        ) : null}
        {editor ? (
          <MetaRow
            lead={<PersonDisc person={editor} />}
            at={edited}
            when={edited !== undefined ? relativeSince(edited, now) : ''}
          >
            Edited by <span className={META_NAME}>{editor.name}</span>
          </MetaRow>
        ) : null}
      </div>
    </footer>
  );
}

const META_NAME = 'font-medium text-slate-700 dark:text-slate-200';
const FormGlyph = lucideGlyph(lucideClipboardList, 14);

// One footer row: a disc (or a glyph), the words, and when at the row's end, the exact moment on hover.
function MetaRow({
  lead,
  children,
  at,
  when,
}: {
  lead: ReactNode;
  children: ReactNode;
  at: number | undefined;
  when: string;
}) {
  return (
    <div data-item-meta-row="" className="flex min-h-7 items-center gap-2">
      <span className="flex size-5 shrink-0 items-center justify-center text-slate-400">
        {lead}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {at !== undefined ? (
        <Tooltip label={stampMomentLabel(at)}>
          <time
            dateTime={new Date(at).toISOString()}
            className="shrink-0 whitespace-nowrap text-[11px] tabular-nums"
          >
            {when}
          </time>
        </Tooltip>
      ) : null}
    </div>
  );
}
