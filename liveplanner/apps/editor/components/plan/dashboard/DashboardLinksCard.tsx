'use client';

// A Links card (docs/specs/026-plan/plan-tabs.md "Cards"): a heading over labelled links, to a site (opened in a new
// browser tab, only http, https or mailto: safeLinkUrl) or to a tab of this project (opened here). Each link is a row:
// its kind's icon (a globe, an envelope, or the tab's own icon), its label and, muted under it, the host or "Tab in this
// project". An Editor adds one with Add Link, whose form opens straight under the links (AddLinkForm), and removes
// one by its ×, shown on hover (always on a touch screen); each change is one step. Everything under the heading
// scrolls when the slot is short, top-aligned.
import { useState } from 'react';
import { DASHBOARD_LINKS_MAX, type DashboardLink } from '@liveplanner/project';
import { linkLabelOf } from '@liveplanner/plan-art';
import { CompactEmptyState, lucideGlyph } from '@liveplanner/ui';
import {
  lucideExternalLink,
  lucideGlobe,
  lucideLink,
  lucideMail,
  lucidePlus,
  lucideX,
} from '@liveplanner/icons/lucide';
import { TabModeIcon } from '@/components/chrome/editor-mode/TabModeIcon';
import { useDashboard } from './dashboard-context';
import { CARD_BODY, CardHeading } from './card-parts';
import { AddLinkForm } from './AddLinkForm';
import { linkDetail } from './link-address';

const GlobeGlyph = lucideGlyph(lucideGlobe, 14);
const MailGlyph = lucideGlyph(lucideMail, 14);
const LinkGlyph = lucideGlyph(lucideLink, 14);
const ExternalGlyph = lucideGlyph(lucideExternalLink, 12);
const RemoveGlyph = lucideGlyph(lucideX, 12);
const PlusGlyph = lucideGlyph(lucidePlus, 14);

const ROW_HIT =
  'flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-300';
const ICON_WELL =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 transition group-hover/link:bg-brand-50 group-hover/link:text-brand-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover/link:bg-brand-500/15 dark:group-hover/link:text-brand-300';
// Shown on hover or focus; always on a screen with no hover (a phone).
const ON_HOVER =
  'opacity-0 transition group-hover/link:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100';

// The label a link shows: shared with the card's picture in an image export.
const labelOf = linkLabelOf;
export { labelOf };

function LinkText({ label, detail }: { label: string; detail: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13px] font-medium text-slate-800 transition group-hover/link:text-brand-700 dark:text-slate-100 dark:group-hover/link:text-brand-300">
        {label}
      </span>
      <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
        {detail}
      </span>
    </span>
  );
}

export function DashboardLinksCard({
  slotId,
  links,
}: {
  slotId: string;
  links: { title: string; links: DashboardLink[] };
}) {
  const { canEdit, actions, openTab, tabs } = useDashboard();
  const [adding, setAdding] = useState(false);
  const tabName = (id: string) => tabs.find((t) => t.id === id)?.name;
  const save = (next: Partial<typeof links>) =>
    actions.setSlotContent(slotId, { type: 'links', ...links, ...next });
  const full = links.links.length >= DASHBOARD_LINKS_MAX;
  return (
    <div className={`@container ${CARD_BODY}`}>
      <CardHeading
        value={links.title}
        canEdit={canEdit}
        label="Links heading"
        onSave={(title) => save({ title })}
      />
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-1 pb-0.5">
        {links.links.length > 0 ? (
          <ul className="flex flex-col gap-0.5">
            {links.links.map((link) => {
              const label = labelOf(link, tabName);
              const tab = link.tabId ? tabs.find((t) => t.id === link.tabId) : undefined;
              const icon = link.tabId ? (
                tab ? (
                  <TabModeIcon tab={tab} />
                ) : (
                  <LinkGlyph />
                )
              ) : link.url?.startsWith('mailto:') ? (
                <MailGlyph />
              ) : (
                <GlobeGlyph />
              );
              const inner = (
                <>
                  <span aria-hidden className={ICON_WELL}>
                    {icon}
                  </span>
                  <LinkText label={label} detail={linkDetail(link)} />
                </>
              );
              return (
                <li
                  key={link.id}
                  className="group/link flex items-center rounded-lg transition hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                >
                  {link.tabId ? (
                    <button type="button" onClick={() => openTab(link.tabId)} className={ROW_HIT}>
                      {inner}
                    </button>
                  ) : (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={ROW_HIT}
                    >
                      {inner}
                      <span aria-hidden className={`shrink-0 text-slate-400 ${ON_HOVER}`}>
                        <ExternalGlyph />
                      </span>
                    </a>
                  )}
                  {canEdit ? (
                    <button
                      type="button"
                      aria-label={`Remove ${label}`}
                      onClick={() => save({ links: links.links.filter((l) => l.id !== link.id) })}
                      className={`mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 ${ON_HOVER}`}
                    >
                      <RemoveGlyph />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : !adding ? (
          <CompactEmptyState
            icon={<LinkGlyph />}
            title="No links yet"
            description={
              canEdit ? 'Add Link puts a site or a tab of this project here.' : undefined
            }
          />
        ) : null}
        {canEdit && adding ? (
          <AddLinkForm
            tabs={tabs}
            onAdd={(link) => {
              save({ links: [...links.links, link] });
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : canEdit && !full ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex cursor-pointer items-center gap-1.5 self-start rounded-md px-1.5 py-1 text-[12px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-300"
          >
            <PlusGlyph />
            Add Link
          </button>
        ) : null}
      </div>
    </div>
  );
}
