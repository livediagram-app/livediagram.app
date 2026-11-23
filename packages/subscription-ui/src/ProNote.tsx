'use client';

import type { LimitKey } from '@liveworkspace/subscription';
import { BrandMark } from '@liveworkspace/brand';
import { Button } from '@liveworkspace/ui';
import { proOn } from './flag';
import { ProBadge } from './ProBadge';
import { useUpgrade } from './provider/hooks';
import { ownerViewOf, type OwnerViewInput } from './state';

export type ProNoteProps = {
  /** What the owner's tier does here and what Pro does, in two short sentences: "Free keeps 7 days of history. Pro
   *  keeps it forever." */
  children: string;
  /** The open item's owner, as `useOwnerView(scope)` answers (or the view itself). It decides the action, by the
   *  same rules as LimitNotice: See Pro for someone who may upgrade, Ask an Admin for a team's member, the sentence
   *  alone for anyone else. */
  owner: OwnerViewInput;
  /** The limit the note is about, which the upgrade dialog opens on. */
  limitKey?: LimitKey;
  /** Where it sits. `foot` (the default): closing a dialog's list, a dashed rule over it, the dialog's own gutter.
   *  `rail`: the same at the foot of a narrow rail. `box`: on its own among other blocks, dashed all round. */
  layout?: 'foot' | 'rail' | 'box';
  /** Space around it only: the layout owns its padding and its rule. */
  className?: string;
  /** What anyone who cannot act on the owner's tier reads (a collaborator, a signed-out visitor, or while the owner's
   *  view loads): the limit as it applies here, with no tier named, so drawn without the badge ("Snapshots here are
   *  kept for 7 days."). A collaborator is never told the owner's tier (subscription.md "Who pays for an item").
   *  Without it they read `children`. */
  others?: string;
};

// The Pro badge's mark, in the button's own ink: the button says Pro in its words, so the mark is decorative.
const ProMark = () => (
  <span aria-hidden data-pro-note-mark="" className="inline-flex [&_svg]:size-3">
    <BrandMark app="livediagram" tone="mono" />
  </span>
);

const LAYOUT: Record<NonNullable<ProNoteProps['layout']>, string> = {
  foot: 'border-t px-5 py-3.5',
  rail: 'border-t px-3 py-3',
  box: 'rounded-lg border px-3 py-2.5',
};

/**
 * The quiet line at the foot of a list a tier trims (subscription.md "What people see"; the Version History design):
 * what the tier keeps beside what Pro keeps, and See Pro for someone who may upgrade, the Pro mark in the button
 * itself (owner, 2026-11-22: one control, not a badge and a button). With no button to carry it, the outline badge
 * leads the sentence. It sits on
 * the list's ground with a dashed rule over it, never as a warning: nothing has gone wrong.
 *
 * Renders nothing with Pro off, or once the owner's tier is past Free.
 */
export function ProNote({
  children,
  owner,
  limitKey,
  layout = 'foot',
  className,
  others,
}: ProNoteProps) {
  const upgrade = useUpgrade();
  if (!proOn()) return null;
  const view = ownerViewOf(owner);
  // The words come from the item's last read; the owner's view is live. Once it says the owner is past Free (an
  // upgrade in another tab, or the checkout just now), there is nothing left to offer and the line goes, before the
  // item is read again.
  if (view?.tier && view.tier !== 'free') return null;
  const action = view?.action ?? 'none';
  const target = view ? { owner: view.owner, ...(limitKey ? { limit: limitKey } : {}) } : {};
  const plain = others !== undefined && action === 'none';
  return (
    <div
      role="note"
      data-pro-note={action}
      data-pro-note-layout={layout}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2.5 border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/40 ${LAYOUT[layout]}${
        className ? ` ${className}` : ''
      }`}
    >
      {plain || action !== 'none' ? null : <ProBadge form="outline" size="sm" decorative />}
      <span className="min-w-0 flex-1 basis-56 text-pretty text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        {plain ? others : children}
      </span>
      {action === 'upgrade' ? (
        <Button
          variant="secondary"
          size="xs"
          className="relative touch-target shrink-0"
          onClick={() => upgrade.openUpgrade(target)}
        >
          <ProMark />
          See Pro
        </Button>
      ) : action === 'ask_admin' ? (
        <Button
          variant="secondary"
          size="xs"
          className="relative touch-target shrink-0"
          onClick={() => upgrade.openAskAdmin(target)}
        >
          <ProMark />
          Ask an Admin
        </Button>
      ) : null}
    </div>
  );
}
