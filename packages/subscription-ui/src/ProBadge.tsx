'use client';

import { BrandMark } from '@liveworkspace/brand';
import { Tooltip } from '@liveworkspace/ui';
import { proOn } from './flag';

/** `solid`: you have Pro. `outline`: the thing is part of Pro. `mark`: the logo alone, where space is tight. */
export type ProBadgeForm = 'solid' | 'outline' | 'mark';

export type ProBadgeProps = {
  form?: ProBadgeForm;
  /** `md` (20px tall) in a heading or a card; `sm` (18px) inside a row, a menu or beside a name. */
  size?: 'sm' | 'md';
  /** `ink`: on a ground that is dark in both appearances (the upgrade dialog's band), so the pair is the dark one
   *  whatever the page's appearance. Default: follows the page. */
  ground?: 'page' | 'ink';
  /** What the badge says, as its accessible name and its tooltip. Default "You Have Pro" (solid) or "Part of Pro". */
  label?: string;
  /** False where the badge sits inside a control that already has a tooltip of its own. */
  tooltip?: boolean;
  /** Inside a control whose own words already say it ("Part of Pro"): hidden from assistive technology, no tooltip. */
  decorative?: boolean;
  className?: string;
};

// The ink pill (subscription.md "What people see", "The Pro badge"). One badge in every app, so it never competes
// with an app's accent or the amber of a warning; the dark appearance inverts the pair.
const FORM: Record<'page' | 'ink', Record<'solid' | 'outline', string>> = {
  page: {
    solid: 'forced-edge bg-slate-900 text-white dark:bg-white dark:text-slate-900',
    outline:
      'border border-slate-300 bg-white text-slate-700 dark:border-slate-500 dark:bg-transparent dark:text-slate-200',
  },
  ink: {
    solid: 'forced-edge bg-white text-slate-900',
    outline: 'border border-slate-500 bg-transparent text-slate-200',
  },
};

const PILL: Record<'sm' | 'md', string> = {
  sm: 'h-[18px] gap-1 pr-[7px] pl-[5px] text-[10px] [&_svg]:size-3',
  md: 'h-5 gap-1 pr-2 pl-1.5 text-[11px] [&_svg]:size-[13px]',
};

const MARK: Record<'sm' | 'md', string> = {
  sm: 'size-[18px] rounded-[5px] [&_svg]:size-[13px]',
  md: 'size-5 rounded-md [&_svg]:size-3.5',
};

export const PRO_BADGE_LABEL: Record<ProBadgeForm, string> = {
  solid: 'You Have Pro',
  outline: 'Part of Pro',
  mark: 'Part of Pro',
};

/**
 * The Pro badge: the small liveworkspace logo and PRO in an ink pill. Renders nothing with Pro off.
 *
 * The logo is drawn in the pill's own ink (the mark's one-colour tone), so it reads on either ground.
 */
export function ProBadge({
  form = 'solid',
  size = 'md',
  ground = 'page',
  label = PRO_BADGE_LABEL[form],
  tooltip = true,
  decorative = false,
  className,
}: ProBadgeProps) {
  if (!proOn()) return null;
  const look = FORM[ground][form === 'solid' ? 'solid' : 'outline'];
  const shape =
    form === 'mark'
      ? `justify-center ${MARK[size]}`
      : `rounded-md font-bold tracking-[0.06em] ${PILL[size]}`;
  const badge = (
    <span
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
      data-pro-badge={form}
      className={`inline-flex shrink-0 items-center leading-none whitespace-nowrap select-none ${shape} ${look}${
        className ? ` ${className}` : ''
      }`}
    >
      {/* The Living Prism in one colour: the app is only whose geometry is drawn, and every app's is the same. */}
      <BrandMark app="livediagram" tone="mono" />
      {form === 'mark' ? null : <span aria-hidden>PRO</span>}
    </span>
  );
  return tooltip && !decorative ? <Tooltip label={label}>{badge}</Tooltip> : badge;
}
