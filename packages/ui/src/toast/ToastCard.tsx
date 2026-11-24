'use client';

// The one toast card (liveworkspace/docs/specs/016-notifications/toasts.md "One line by default, stacked when there
// is more to say" and "Look"), for every toast and every notice in the stack (an Inbox notice, a suggestion, the
// paste notice). Two layouts:
// - Inline, a plain toast: icon, message, actions, close, on one row. The message keeps its buttons beside it,
//   wrapping onto a second line itself, while it has 10rem to wrap in; only then do the buttons drop to a row of their
//   own at its end (a phone's sign-in toast had Sign In stranded under a one-line message, the owner, 2026-11-20).
// - Stacked, a card with more to say (a title, a switch, a quiet answer, rows of its own): the icon, title and close on
//   the first line, the message and the rest under it at the card's full width, the actions on a foot row (the owner,
//   2026-11-24: Make These a Plan's words were squeezed into a narrow column beside Send to Plan).
// Presentational: the stack owns timing and leaving.
import { useState, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import {
  lucideCircleAlert,
  lucideCircleCheck,
  lucideInfo,
  lucideSparkles,
  lucideTriangleAlert,
} from '@liveworkspace/icons/lucide';
import { CloseIcon } from '../icons/actions';
import { lucideGlyph } from '../icons/lucide-glyph';
import { SwitchRow } from '../Switch';
import { Tooltip } from '../Tooltip';
import type { ToastTone, ToastToggle } from './toast-queue';

/** The toast's card look, shared with the notices that are not in the stack (the new-version prompt). */
export const TOAST_SURFACE =
  'rounded-xl border bg-white text-slate-800 shadow-lg shadow-slate-900/10 dark:bg-slate-900 dark:text-slate-100 dark:shadow-black/40';

const BORDER: Record<ToastTone, string> = {
  info: 'border-slate-200 dark:border-slate-700',
  success: 'border-slate-200 dark:border-slate-700',
  warning: 'border-amber-200 dark:border-amber-500/40',
  error: 'border-rose-200 dark:border-rose-500/40',
};

/** Each tone's icon colour and glyph, shared with the notification list's rows. */
export const TOAST_ICON_TINT: Readonly<Record<ToastTone, string>> = {
  info: 'text-brand-700 dark:text-brand-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-rose-600 dark:text-rose-400',
};

export const TOAST_ICONS: Readonly<Record<ToastTone, ReturnType<typeof lucideGlyph>>> = {
  info: lucideGlyph(lucideInfo, 16),
  success: lucideGlyph(lucideCircleCheck, 16),
  warning: lucideGlyph(lucideTriangleAlert, 16),
  error: lucideGlyph(lucideCircleAlert, 16),
};

// The highlight look (toasts.md "Highlight"): a solid emerald card for the one toast that asks to be noticed (the
// guest sign-in toast), with a sparkle for its icon. White on emerald-700 reads at 5.5:1 and on emerald-800 at 7.7:1;
// the white Sign In button's emerald-800 label at 7.7:1. In forced colours the fill drops and the border stays.
const HIGHLIGHT_SURFACE =
  'rounded-xl border border-emerald-800/30 bg-emerald-700 text-white shadow-lg shadow-emerald-900/25 dark:border-emerald-400/30 dark:bg-emerald-800 dark:shadow-black/40';
const HIGHLIGHT_ICON = lucideGlyph(lucideSparkles, 16);

const ACTION_BASE =
  'touch-target relative inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-50';
// A button's size: a compact text button, 32px tall (44px to tap); a quiet answer is small text.
const ACTION_SIZE = 'h-8 rounded-lg text-sm font-semibold';
// On a stacked card's foot row the same text buttons stand 24px tall (44px to tap on a touch screen), so the row costs
// little more than the line of words it replaces (toasts.md "Stacked").
const FOOT_SIZE = 'h-6 rounded-md text-sm font-semibold';
const ACTION_PAD = 'px-2.5';
const ACTION_PRIMARY =
  'text-brand-700 enabled:hover:bg-brand-50 dark:text-brand-300 dark:enabled:hover:bg-brand-500/15';
// A destructive answer (toasts.md "A destructive answer"): rose-700 reads at over 6:1 on white, rose-300 at over 9:1 on
// slate-900.
const ACTION_DESTRUCTIVE =
  'text-rose-700 enabled:hover:bg-rose-50 focus-visible:outline-rose-700 dark:text-rose-300 dark:enabled:hover:bg-rose-500/15 dark:focus-visible:outline-rose-300';
const ACTION_HIGHLIGHT_PRIMARY =
  'bg-white text-emerald-800 shadow-sm enabled:hover:bg-emerald-50 focus-visible:outline-white';
const ACTION_HIGHLIGHT_SECONDARY =
  'text-white/90 enabled:hover:bg-white/15 enabled:hover:text-white';
const ACTION_SECONDARY =
  'text-slate-600 enabled:hover:bg-slate-100 enabled:hover:text-slate-900 dark:text-slate-300 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-white';

export type ToastCardAction = {
  label: string;
  ariaLabel?: string;
  // A press; an action with `href` is a link instead, and this runs as it is followed.
  onSelect?: () => void;
  // A link (an Inbox notice's Open in Inbox).
  href?: string;
  disabled?: boolean;
  primary?: boolean;
  destructive?: boolean;
  // A quiet answer at the foot row's start (Don't Suggest This Again): small slate text. Stacks the card.
  quiet?: boolean;
};

export type ToastCardLayout = 'inline' | 'stacked';

/** The card's layout: stacked when it has more to say than one message and its buttons. */
export function toastCardLayout(parts: {
  title?: ReactNode;
  body?: ReactNode;
  toggle?: unknown;
  actions?: readonly ToastCardAction[];
}): ToastCardLayout {
  const more =
    (parts.title !== undefined && parts.title !== null && parts.title !== false) ||
    (parts.body !== undefined && parts.body !== null && parts.body !== false) ||
    parts.toggle !== undefined ||
    (parts.actions ?? []).some((a) => a.quiet);
  return more ? 'stacked' : 'inline';
}

// A quiet answer: small slate text, underlined on hover. slate-500 on white reads at 4.8:1, slate-400 on slate-900 at
// 6.9:1.
const ACTION_QUIET =
  'rounded text-xs font-medium text-slate-500 underline-offset-2 enabled:hover:text-slate-700 enabled:hover:underline [&:not(button)]:hover:underline dark:text-slate-400 dark:enabled:hover:text-slate-200';
const ACTION_HIGHLIGHT_QUIET =
  'rounded text-xs font-medium text-white/85 underline-offset-2 enabled:hover:text-white enabled:hover:underline';

function actionLook(action: ToastCardAction, highlight: boolean): string {
  if (action.quiet) return highlight ? ACTION_HIGHLIGHT_QUIET : ACTION_QUIET;
  if (highlight) return action.primary ? ACTION_HIGHLIGHT_PRIMARY : ACTION_HIGHLIGHT_SECONDARY;
  if (action.destructive) return ACTION_DESTRUCTIVE;
  return action.primary ? ACTION_PRIMARY : ACTION_SECONDARY;
}

function ActionButton({
  action,
  highlight,
  stacked,
}: {
  action: ToastCardAction;
  highlight: boolean;
  stacked: boolean;
}) {
  // The highlight's solid white button has a little more room either side of its words.
  const solid = action.primary && highlight;
  const size = action.quiet
    ? ''
    : `${stacked ? FOOT_SIZE : ACTION_SIZE} ${solid ? 'px-3' : stacked ? 'px-1.5' : ACTION_PAD}`;
  const className = `${ACTION_BASE} ${size} ${actionLook(action, highlight)}`;
  if (action.href !== undefined)
    return (
      <a
        href={action.href}
        onClick={action.onSelect}
        aria-label={action.ariaLabel}
        className={className}
      >
        {action.label}
      </a>
    );
  return (
    <button
      type="button"
      onClick={action.onSelect}
      disabled={action.disabled}
      aria-label={action.ariaLabel}
      data-toast-destructive={action.destructive ? '' : undefined}
      data-toast-quiet={action.quiet ? '' : undefined}
      className={className}
    >
      {action.label}
    </button>
  );
}

// The toast's switch (toasts.md "A switch on a toast"), on a row of its own under the message: the house SwitchRow, its
// words and track one button. It holds its own state, started again for each new toggle a newer upsert brings.
function ToastSwitch({ toggle, highlight }: { toggle: ToastToggle; highlight: boolean }) {
  const [state, setState] = useState({ of: toggle, on: toggle.checked === true });
  const on = state.of === toggle ? state.on : toggle.checked === true;
  return (
    <SwitchRow
      checked={on}
      track="start"
      layout="flex items-center gap-2 rounded-md text-left"
      className={`touch-target relative -ml-0.5 text-sm font-medium ${highlight ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}
      onChange={(next) => {
        setState({ of: toggle, on: next });
        toggle.onChange(next);
      }}
    >
      {toggle.label}
    </SwitchRow>
  );
}

const CLOSE_LOOK = {
  plain:
    'text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-brand-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
  highlight: 'text-white/80 hover:bg-white/15 hover:text-white focus-visible:outline-white',
};

export function ToastCard({
  tone,
  title,
  message,
  body,
  icon,
  actions = [],
  toggle,
  onClose,
  layout,
  leaving = false,
  full = false,
  highlight = false,
  role,
  className = '',
  ref,
  ...rest
}: {
  ref?: Ref<HTMLDivElement>;
  tone: ToastTone;
  // A stacked card's first line, bold (Make These a Plan, Priya mentioned you).
  title?: ReactNode;
  message?: ReactNode;
  // What else a stacked card holds, under the message at full width (a list of rows, a place in small text).
  body?: ReactNode;
  // In place of the tone's icon (an Inbox notice's kind: a mention's @, a card).
  icon?: ReactNode;
  actions?: readonly ToastCardAction[];
  toggle?: ToastToggle;
  // No close for a card that cannot be sent away (the paste notice's progress).
  onClose?: () => void;
  // Worked out from what the card holds (toastCardLayout) unless given.
  layout?: ToastCardLayout;
  leaving?: boolean;
  // Arrived on a full stack: the bolder entrance (toast-in-full), so a new toast on a busy stack is seen.
  full?: boolean;
  // The highlight look: solid emerald, a sparkle icon, a white primary button.
  highlight?: boolean;
  // A notice that announces itself elsewhere (an Inbox notice's own live line) is a plain group.
  role?: 'alert' | 'status' | 'group';
} & Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'children' | 'title'>) {
  const Icon = highlight ? HIGHLIGHT_ICON : TOAST_ICONS[tone];
  const shape = layout ?? toastCardLayout({ title, body, toggle, actions });
  const stacked = shape === 'stacked';
  const motion = leaving
    ? 'pointer-events-none animate-toast-out'
    : full
      ? 'pointer-events-auto animate-toast-in-full'
      : 'pointer-events-auto animate-toast-in';
  const surface = highlight ? HIGHLIGHT_SURFACE : `${TOAST_SURFACE} ${BORDER[tone]}`;
  const iconTint = highlight ? 'text-white' : TOAST_ICON_TINT[tone];
  const close = onClose ? (
    <Tooltip label="Dismiss">
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className={`touch-target relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 ${highlight ? CLOSE_LOOK.highlight : CLOSE_LOOK.plain} ${stacked ? 'float-right -mr-1.5 -mt-1.5 mb-[-0.75rem] ml-2' : ''}`}
      >
        <CloseIcon size={12} />
      </button>
    </Tooltip>
  ) : null;
  const buttons = actions.map((action) => (
    <ActionButton key={action.label} action={action} highlight={highlight} stacked={stacked} />
  ));
  const shared = {
    ref,
    role: role ?? (tone === 'error' ? 'alert' : 'status'),
    'data-toast-tone': tone,
    'data-toast-layout': shape,
    'data-toast-highlight': highlight ? '' : undefined,
  } as const;

  if (stacked) {
    const quiet = buttons.filter((_, i) => actions[i]!.quiet);
    const answers = buttons.filter((_, i) => !actions[i]!.quiet);
    return (
      <div
        {...shared}
        className={`flex w-full items-start gap-2.5 px-3 py-2.5 sm:w-auto sm:min-w-[20rem] sm:max-w-[36rem] ${surface} ${motion} ${className}`}
        {...rest}
      >
        <span className={`flex h-5 shrink-0 items-center ${iconTint}`} aria-hidden>
          {icon ?? <Icon />}
        </span>
        {/* A block, so the close floats in the first line's corner and every line under it runs the full width. */}
        <div className="min-w-0 flex-1 text-sm leading-5 [overflow-wrap:anywhere]">
          {close}
          {title ? (
            <p
              data-toast-title=""
              className={`font-semibold ${highlight ? 'text-white' : 'text-slate-900 dark:text-white'}`}
            >
              {title}
            </p>
          ) : null}
          {message ? (
            <div
              data-toast-message=""
              className={
                title ? `${highlight ? 'text-white/90' : 'text-slate-600 dark:text-slate-300'}` : ''
              }
            >
              {message}
            </div>
          ) : null}
          {body ? <div className="mt-1">{body}</div> : null}
          {buttons.length > 0 || toggle ? (
            <div
              data-toast-foot=""
              className="clear-both -mr-1.5 mt-2 flex flex-wrap items-center justify-end gap-x-1 gap-y-1"
            >
              {/* The switch and any quiet answer at the row's start: choices about the asking, not answers. */}
              {quiet.length > 0 || toggle ? (
                <div className="mr-auto flex items-center gap-3">
                  {toggle ? (
                    <div data-toast-toggle="">
                      <ToastSwitch toggle={toggle} highlight={highlight} />
                    </div>
                  ) : null}
                  {quiet}
                </div>
              ) : null}
              {/* The answers wrap as one group, never split across rows. */}
              {answers.length > 0 ? (
                <div className="ml-auto flex items-center gap-1">{answers}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      {...shared}
      className={`flex w-full items-start gap-3 py-1.5 pl-3 pr-1.5 sm:w-auto sm:max-w-[36rem] ${surface} ${motion} ${className}`}
      {...rest}
    >
      <span className={`flex h-8 shrink-0 items-center ${iconTint}`} aria-hidden>
        {icon ?? <Icon />}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
        <p className="min-w-0 flex-[1_1_10rem] py-1.5 text-sm leading-5">{message}</p>
        {buttons.length > 0 ? (
          <div className="ml-auto flex shrink-0 items-center gap-1">{buttons}</div>
        ) : null}
      </div>
      {close}
    </div>
  );
}
