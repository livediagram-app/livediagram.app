'use client';

// Sprint Review's demo strip over the card (docs/specs/026-plan/session-tabs.md "Sprint Review"): who presents it (a
// person picker for the facilitator), its pull requests with their state, and its designs (Image fields' and picture
// Attachments' thumbnails, Link fields as chips), there to demo from. A card with none says so; on a phone the strip
// scrolls sideways in one row.
import {
  fieldImageIds,
  isItemPerson,
  isPictureAttachmentType,
  itemAttachments,
  parsePullRequestUrl,
  pullRequestText,
  pullRequestUrl,
  type Item,
  type ItemPerson,
  type ItemTypeDef,
} from '@liveplanner/items';
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideExternalLink, lucideLink } from '@liveworkspace/icons/lucide';
import { PersonPicker } from '@/components/plan/PersonPicker';
import { PersonDisc } from '@/components/plan/PersonDisc';
import type { ImagesScope } from '@/lib/api/images';
import { githubHref } from '@/components/plan/PullRequestField';
import { PullRequestChip } from '@/components/plan/PullRequestPill';
import { useCardPullRequests } from '@/components/plan/pull-request-store';
import { useImageUrl, useSeen } from '@/components/plan/use-image-url';

const OpenIcon = lucideGlyph(lucideExternalLink, 12);
const LinkIcon = lucideGlyph(lucideLink, 12);
const HEADING =
  'mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
// Thumbnails are fetched at this edge: 64 px tall at up to 2x.
const THUMB_EDGE = 256;

// A design: a picture (an Image field's or a picture Attachment) by its image id, named.
export type DemoPicture = { id: string; name: string };
// A Link field's address, named by its field.
export type DemoLink = { name: string; href: string };

// The card's pictures, its Image fields' first then its picture Attachments, each once.
export function demoPictures(item: Item, type: ItemTypeDef): DemoPicture[] {
  const out: DemoPicture[] = [];
  const seen = new Set<string>();
  const add = (id: string, name: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, name });
  };
  for (const f of type.custom ?? [])
    if (f.kind === 'image' && type.fields.includes(f.id))
      for (const id of fieldImageIds(f, item.fields[f.id])) add(id, f.label);
  for (const a of itemAttachments(item)) if (isPictureAttachmentType(a.type)) add(a.id, a.name);
  return out;
}

// The card's Link fields that hold an https or http address that is not a pull request's (those show as one).
export function demoLinks(item: Item, type: ItemTypeDef): DemoLink[] {
  const out: DemoLink[] = [];
  for (const f of type.custom ?? []) {
    const v = item.fields[f.id];
    if (f.kind !== 'link' || !type.fields.includes(f.id) || typeof v !== 'string') continue;
    if (parsePullRequestUrl(v)) continue;
    try {
      const url = new URL(v);
      if (url.protocol === 'https:' || url.protocol === 'http:')
        out.push({ name: f.label, href: url.href });
    } catch {
      // Not an address: nothing to open.
    }
  }
  return out;
}

export function DemoStrip({
  item,
  type,
  presenter,
  presenterOn,
  canPick,
  people,
  scope,
  onPresenter,
}: {
  item: Item;
  type: ItemTypeDef;
  presenter: ItemPerson | null;
  // The set-up shows a presenter (Presenter: Assignee).
  presenterOn: boolean;
  // The facilitator may name someone else.
  canPick: boolean;
  // The plan's people, for the presenter picker; the plan's reads, for the thumbnails.
  people: readonly ItemPerson[];
  scope: ImagesScope | null | undefined;
  onPresenter: (who: ItemPerson | null) => void;
}) {
  const prs = useCardPullRequests(item, type);
  const pictures = demoPictures(item, type);
  const links = demoLinks(item, type);
  const empty = prs.length === 0 && pictures.length === 0 && links.length === 0;
  return (
    <div
      role="region"
      aria-label="Demo"
      data-demo-strip=""
      className="scrollbar-slim flex shrink-0 gap-6 overflow-x-auto border-b border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-6 dark:border-slate-800 dark:bg-slate-900/40"
    >
      {presenterOn ? (
        <div className="w-48 shrink-0">
          <h4 className={HEADING}>Presenter</h4>
          {canPick ? (
            <PersonPicker
              id={`presenter-${item.id}`}
              label="Presenter"
              value={presenter ?? undefined}
              people={people}
              disabled={false}
              onSave={(v) => onPresenter(isItemPerson(v) ? v : null)}
            />
          ) : (
            <span className="flex h-8 items-center gap-2 text-[13px] font-medium text-slate-800 dark:text-slate-100">
              {presenter ? (
                <>
                  <PersonDisc person={presenter} />
                  <span className="truncate">{presenter.name}</span>
                </>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">No one</span>
              )}
            </span>
          )}
        </div>
      ) : null}
      {prs.length ? (
        <div className="min-w-[16rem] flex-1">
          <h4 className={HEADING}>Pull Requests</h4>
          <ul className="flex flex-col gap-1.5">
            {prs.map(({ ref, status }) => {
              const name = pullRequestText(ref);
              const href = githubHref(pullRequestUrl(ref));
              return (
                <li key={name}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${name}${status?.title ? `, ${status.title}` : ''} (opens GitHub in a new tab)`}
                    className="flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    <span className="shrink-0 font-medium text-slate-900 dark:text-slate-50">
                      {name}
                    </span>
                    {status ? <PullRequestChip status={status} /> : null}
                    <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">
                      {status?.title ?? ''}
                    </span>
                    <OpenIcon aria-hidden className="shrink-0 text-brand-700 dark:text-brand-300" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {pictures.length || links.length ? (
        <div className="shrink-0">
          <h4 className={HEADING}>Designs</h4>
          <div className="flex items-start gap-2">
            {pictures.map((p) => (
              <Thumb key={p.id} picture={p} scope={scope} />
            ))}
            {links.length ? (
              <ul className="flex flex-col gap-1.5">
                {links.map((l) => (
                  <li key={`${l.name}:${l.href}`}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 max-w-[14rem] cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[12px] font-medium text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-brand-300 dark:hover:bg-brand-500/10"
                      aria-label={`${l.name} (opens in a new tab)`}
                    >
                      <LinkIcon aria-hidden className="shrink-0" />
                      <span className="text-optical-line min-w-0 truncate">{l.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
      {empty ? (
        <p className="self-center text-[13px] text-slate-500 dark:text-slate-400">
          Nothing linked to demo
        </p>
      ) : null}
    </div>
  );
}

// One picture, 64 px tall, fetched once near the screen; pressing it opens it in a new tab.
function Thumb({
  picture,
  scope,
}: {
  picture: DemoPicture;
  scope: ImagesScope | null | undefined;
}) {
  const [ref, seen] = useSeen<HTMLAnchorElement>();
  const shown = useImageUrl(scope, picture.id, THUMB_EDGE, seen);
  const url = shown.state === 'shown' ? shown.url : undefined;
  return (
    <Tooltip label={picture.name}>
      <a
        ref={ref}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${picture.name} (opens in a new tab)`}
        data-demo-picture={picture.id}
        className="flex h-16 w-[85px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-slate-800 dark:ring-slate-700"
      >
        {url ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {shown.state === 'missing' ? 'Missing' : ''}
          </span>
        )}
      </a>
    </Tooltip>
  );
}
