'use client';

import type { ReactNode } from 'react';
import { TIER_NAMES } from '@liveworkspace/subscription';
import { Button, buttonClassName, ButtonContent, CheckIcon } from '@liveworkspace/ui';
import { proOn } from './flag';
import { upgradeLabel, upgradeTier } from './limit-copy';
import { ProBadge } from './ProBadge';
import { useUpgrade } from './provider/hooks';
import { ownerViewOf, type OwnerViewInput } from './state';

export type ProGateProps = {
  /** What the feature does with Pro, as a heading: "Send Webhooks with Pro". */
  title: string;
  /** One or two sentences on what it is for. */
  description: string;
  /** Up to four short lines of what it includes, each with a tick. */
  points?: readonly string[];
  /** The open item's owner, as `useOwnerView(scope)` answers (or the view itself): it decides the action, by the
   *  same rules as LimitNotice. */
  owner: OwnerViewInput;
  /** A small picture of the feature at work, beside the words (under them on a phone). Decorative. */
  art?: ReactNode;
  /** What the open item is called in its app ("plan", "canvas"), for the line a collaborator reads. "item" when not
   *  given. */
  noun?: string;
  /** A quiet closing line: what stays free. "Everything else in Automations stays on Free." */
  footnote?: string;
  /** `h1` where the gate is all its surface says; `h2` (the default) inside a dialog or a panel with a title. */
  heading?: 'h1' | 'h2';
  /** `panel`: inside a side panel or a narrow column, where the surface around it already pads: no padding of its
   *  own, smaller words and buttons. `page` (the default) where the gate is the surface. */
  density?: 'page' | 'panel';
  className?: string;
};

// The gate's sizes: on its own surface, and inside a panel that already pads.
const DENSITY = {
  page: {
    box: 'gap-x-12 gap-y-8 px-5 py-8 sm:px-10 sm:py-12',
    words: 'gap-5',
    title: 'text-2xl sm:text-[28px]',
    description: 'text-[15px]',
    points: 'gap-3 text-sm',
    art: 'p-5 sm:p-7',
    button: 'md',
  },
  panel: {
    box: 'gap-5',
    words: 'gap-4',
    title: 'text-lg',
    description: 'text-[13px]',
    points: 'gap-2 text-[13px]',
    art: 'p-4',
    button: 'sm',
  },
} as const;

/**
 * "This is part of Pro": the panel a feature shows in its own place when the owner's tier does not include it
 * (subscription.md "What people see"). The owner, or a team's admin,
 * is offered the upgrade; a team's member is pointed at an admin; anyone else is told whose tier decides it.
 *
 * Renders nothing with Pro off: a build without Pro has no gated feature.
 */
export function ProGate({
  title,
  description,
  points = [],
  owner,
  art,
  noun = 'item',
  footnote,
  heading: Heading = 'h2',
  density = 'page',
  className,
}: ProGateProps) {
  const upgrade = useUpgrade();
  if (!proOn()) return null;
  const view = ownerViewOf(owner);
  const action = view?.action ?? 'none';
  const target = view ? { owner: view.owner } : {};
  const tierName = view ? TIER_NAMES[upgradeTier(view)] : TIER_NAMES.pro;
  const size = DENSITY[density];
  const secondaryLink = buttonClassName({ variant: 'secondary', size: size.button });
  return (
    <section
      data-pro-gate={action}
      className={`flex flex-wrap items-center ${size.box}${className ? ` ${className}` : ''}`}
    >
      <div className={`flex min-w-0 flex-[1_1_20rem] flex-col ${size.words}`}>
        <div className="flex flex-col items-start gap-3">
          <ProBadge form="outline" />
          <Heading
            className={`leading-tight font-bold tracking-tight text-balance text-slate-900 dark:text-slate-100 ${size.title}`}
          >
            {title}
          </Heading>
          <p
            className={`leading-relaxed text-pretty text-slate-600 dark:text-slate-300 ${size.description}`}
          >
            {description}
          </p>
        </div>
        {points.length > 0 ? (
          <ul className={`flex flex-col ${size.points}`}>
            {points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2.5 leading-normal text-slate-700 dark:text-slate-200"
              >
                <span
                  aria-hidden
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-brand-700 dark:text-brand-300"
                >
                  <CheckIcon />
                </span>
                {point}
              </li>
            ))}
          </ul>
        ) : null}
        {action === 'upgrade' && view ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button size={size.button} onClick={() => upgrade.openUpgrade(target)}>
              {upgradeLabel(view)}
            </Button>
            <a
              href={upgrade.pricingHref}
              target="_blank"
              rel="noreferrer"
              className={secondaryLink}
            >
              <ButtonContent>See What’s in Pro</ButtonContent>
            </a>
          </div>
        ) : action === 'ask_admin' ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Only a team admin can move this team to {tierName}.
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button size={size.button} onClick={() => upgrade.openAskAdmin(target)}>
                Ask an Admin
              </Button>
              <a
                href={upgrade.pricingHref}
                target="_blank"
                rel="noreferrer"
                className={secondaryLink}
              >
                <ButtonContent>See What’s in Pro</ButtonContent>
              </a>
            </div>
          </div>
        ) : action === 'manage' ? (
          // The owner, or their team's admin, already pays for a tier that includes this: the item's app has not
          // heard yet (it asks the service again within a minute), so nothing is theirs to buy or to ask for.
          <p data-pro-gate-pending className="text-sm text-slate-600 dark:text-slate-300">
            Your subscription includes this. It turns on within a minute.
          </p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {view
              ? `This ${noun}’s owner decides its subscription, and theirs does not include this.`
              : `This is not included for this ${noun}.`}
          </p>
        )}
        {footnote ? (
          <p className="text-xs leading-normal text-slate-500 dark:text-slate-400">{footnote}</p>
        ) : null}
      </div>
      {art ? (
        <div
          aria-hidden
          className={`min-w-0 flex-[1_1_20rem] rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 ${size.art}`}
        >
          {art}
        </div>
      ) : null}
    </section>
  );
}
