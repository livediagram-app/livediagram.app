// The one callout (liveworkspace/docs/specs/016-notifications/callouts.md): a note or an error in place, in a panel,
// dialog, form, Settings row or page, or anchored on the canvas (`floating`). The toast's four tones, icons and inks;
// two sizes; an optional title, one action and a close. `className` places it, never colours or sizes it.

import type { ReactNode } from 'react';
import { CloseIcon } from '../icons/actions';
import { Tooltip } from '../Tooltip';
import { TOAST_ICONS, TOAST_ICON_TINT } from '../toast/ToastCard';

export type CalloutTone = 'info' | 'success' | 'warning' | 'error';
export type CalloutSize = 'sm' | 'md';

/** Each tone's surface and ink, light and dark. */
export const CALLOUT_TONE: Readonly<Record<CalloutTone, string>> = {
  info: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  error:
    'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
};

// Floating over a canvas: the light tints are opaque already; in dark the tint sits on the chrome's own surface.
const FLOATING_DARK: Readonly<Record<CalloutTone, string>> = {
  info: 'dark:bg-slate-900',
  success: 'dark:bg-emerald-950',
  warning: 'dark:bg-amber-950',
  error: 'dark:bg-rose-950',
};

const SIZE: Readonly<Record<CalloutSize, { box: string; icon: number }>> = {
  sm: { box: 'gap-2 px-2.5 py-1.5 text-xs leading-5', icon: 14 },
  md: { box: 'gap-2.5 px-3 py-2 text-sm leading-5', icon: 16 },
};

const BUTTON =
  'touch-target relative shrink-0 rounded font-semibold underline-offset-2 transition enabled:hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-60';

export type CalloutAction = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  // Why it can't run just now: it stays focusable, says why in a tooltip, and does nothing.
  reason?: string | null;
};

export function Callout({
  tone,
  size = 'sm',
  title,
  action,
  onClose,
  floating = false,
  role,
  as: Tag = 'div',
  className,
  children,
}: {
  tone: CalloutTone;
  size?: CalloutSize;
  title?: ReactNode;
  action?: CalloutAction;
  onClose?: () => void;
  floating?: boolean;
  role?: 'alert' | 'status' | 'note';
  // A `p` where the callout sits in a spot that takes phrasing content only.
  as?: 'div' | 'p';
  className?: string;
  children?: ReactNode;
}) {
  const Icon = TOAST_ICONS[tone];
  const { box, icon } = SIZE[size];
  // In a `p`, the parts are spans so the markup stays valid.
  const Part = Tag === 'p' ? 'span' : 'div';
  return (
    <Tag
      role={role}
      data-callout={tone}
      className={[
        'flex items-start rounded-lg border',
        floating
          ? CALLOUT_TONE[tone]
              .split(' ')
              .filter((c) => !c.startsWith('dark:bg-'))
              .join(' ')
          : CALLOUT_TONE[tone],
        box,
        floating ? `shadow-lg shadow-slate-900/10 dark:shadow-black/40 ${FLOATING_DARK[tone]}` : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span aria-hidden className={`flex h-5 shrink-0 items-center ${TOAST_ICON_TINT[tone]}`}>
        <Icon size={icon} />
      </span>
      <Part className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        {title ? <Part className="block font-semibold">{title}</Part> : null}
        {children ? <Part className="block">{children}</Part> : null}
      </Part>
      {action ? <CalloutButton action={action} /> : null}
      {onClose ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className={`${BUTTON} -my-0.5 -mr-1 flex h-6 w-6 items-center justify-center opacity-70 enabled:hover:opacity-100`}
        >
          <CloseIcon size={12} />
        </button>
      ) : null}
    </Tag>
  );
}

function CalloutButton({ action }: { action: CalloutAction }) {
  const button = (
    <button
      type="button"
      onClick={action.reason ? undefined : action.onSelect}
      disabled={action.disabled}
      aria-disabled={action.reason ? true : undefined}
      className={`${BUTTON} ${action.reason ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      {action.label}
    </button>
  );
  return action.reason ? <Tooltip label={action.reason}>{button}</Tooltip> : button;
}
