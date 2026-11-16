'use client';

// The Share dialog's Suggestions section (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md "Suggest
// Only"; livedocuments/docs/specs/007-editor/suggestions.md "Suggest Only"), for an Editor, in every product: each
// Participant link and each person who has joined through one, each with a Suggest Only switch, and (where a product
// has assistants' writing to hold, livedocuments' articles) Assistants Suggest first. A switch saves at once and
// reaches every open Participant; a refused save puts the switch back and says so.
import { useEffect, useId, useState } from 'react';
import { Switch } from '@liveworkspace/ui';
import type { ReviewSettings, StoredReview } from '../review';

/** A share link as the index lists it: the fields this section reads. */
export type SuggestOnlyLink = {
  code: string;
  level: string;
  tabId: string | null;
  createdAt: number;
  public?: boolean;
};

const CARD =
  'divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-700/70 dark:border-slate-700 dark:bg-slate-800';
const ROW =
  'relative flex items-center gap-4 px-4 py-3 transition-colors duration-micro hover:bg-slate-50 dark:hover:bg-slate-700/40';
const GROUP =
  'px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

/** "Made 12 Nov", for a link's row. */
const madeOn = (at: number) =>
  `Made ${new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

/** The links Suggest Only can hold: Participant passes, not public ones. */
const participantLinks = (links: readonly SuggestOnlyLink[]) =>
  links.filter((x) => x.level === 'participate' && !x.public);

function SwitchRow({
  title,
  detail,
  checked,
  busy,
  onChange,
}: {
  title: string;
  detail?: string;
  checked: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <div className={ROW}>
      <div className="min-w-0 flex-1">
        <div
          id={`${id}-t`}
          className="truncate text-sm font-medium text-slate-800 dark:text-slate-100"
        >
          {title}
        </div>
        {detail ? (
          <p
            id={`${id}-d`}
            className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
          >
            {detail}
          </p>
        ) : null}
      </div>
      <Switch
        size="sm"
        checked={checked}
        labelledBy={`${id}-t`}
        describedBy={detail ? `${id}-d` : undefined}
        busy={busy}
        onChange={onChange}
        coversRow
        className="ml-auto"
      />
    </div>
  );
}

export function SuggestOnlySection({
  itemId,
  readReview,
  saveReview,
  listLinks,
  linksRev = 0,
  tabs,
  wholeItem,
  assistants,
  track,
  onError,
}: {
  itemId: string;
  readReview: () => Promise<StoredReview>;
  saveReview: (settings: ReviewSettings) => Promise<StoredReview>;
  listLinks: () => Promise<readonly SuggestOnlyLink[]>;
  // Bumped when the Share dialog makes, rescopes or removes a pass: the links are listed again.
  linksRev?: number;
  // The item's tabs, to name a link that opens one.
  tabs: readonly { id: string; name: string }[];
  // What a link to every tab is called ("Whole Document", "Whole Design", "Whole Plan").
  wholeItem: string;
  // Assistants Suggest's words, where a product has it (livedocuments' articles); absent, no such row.
  assistants?: { title: string; detail: string };
  track: (type: string) => void;
  onError: (text: string) => void;
}) {
  const [review, setReview] = useState<StoredReview | null>(null);
  const [links, setLinks] = useState<SuggestOnlyLink[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.all([readReview(), listLinks().catch(() => [] as SuggestOnlyLink[])])
      .then(([r, l]) => {
        if (!live) return;
        setReview(r);
        setLinks(participantLinks(l));
      })
      .catch(() => {
        if (live) onError('Could not read the suggestion settings.');
      });
    return () => {
      live = false;
    };
    // oxlint-disable-next-line react/exhaustive-deps -- read once as the dialog opens
  }, [itemId]);

  // A pass made, rescoped or removed above while the dialog is open: list the links again.
  useEffect(() => {
    if (linksRev === 0) return;
    let live = true;
    void listLinks()
      .then((l) => {
        if (live) setLinks(participantLinks(l));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // oxlint-disable-next-line react/exhaustive-deps -- only a change above lists them again
  }, [linksRev]);

  const save = async (next: ReviewSettings, event: string) => {
    if (!review) return;
    const before = review;
    setReview({ ...review, ...next });
    setBusy(true);
    try {
      setReview(await saveReview(next));
      track(event);
    } catch {
      setReview(before);
      onError('Could not save the suggestion settings.');
    } finally {
      setBusy(false);
    }
  };
  const settings = (r: StoredReview): ReviewSettings => ({
    links: r.links,
    people: r.people,
    agents: r.agents,
  });
  const tabName = (tabId: string | null) =>
    tabId === null ? wholeItem : (tabs.find((t) => t.id === tabId)?.name ?? 'One Tab');

  return (
    <section
      aria-label="Suggestions"
      data-share-suggestions=""
      className="flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"
    >
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Suggestions</h3>
      {review === null ? (
        <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      ) : (
        <>
          {assistants ? (
            <div className={CARD}>
              <SwitchRow
                title={assistants.title}
                detail={assistants.detail}
                checked={review.agents}
                busy={busy}
                onChange={(on) =>
                  void save(
                    { ...settings(review), agents: on },
                    on ? 'AssistantsSuggestOn' : 'AssistantsSuggestOff',
                  )
                }
              />
            </div>
          ) : null}
          <div className={GROUP}>Participant Links</div>
          {links.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No Participant links yet. Make one above, then set Suggest Only on it here.
            </p>
          ) : (
            <div className={CARD}>
              {links.map((link) => {
                const on = review.links.includes(link.code);
                return (
                  <SwitchRow
                    key={link.code}
                    title={tabName(link.tabId)}
                    detail={`${madeOn(link.createdAt)} · Suggest Only`}
                    checked={on}
                    busy={busy}
                    onChange={(next) =>
                      void save(
                        {
                          ...settings(review),
                          links: next
                            ? [...review.links, link.code]
                            : review.links.filter((c) => c !== link.code),
                        },
                        next ? 'SuggestOnlyLinkOn' : 'SuggestOnlyLinkOff',
                      )
                    }
                  />
                );
              })}
            </div>
          )}
          {review.seen.length > 0 ? (
            <>
              <div className={GROUP}>People</div>
              <div className={CARD}>
                {review.seen.map((person) => {
                  // On by name, or pinned: they came through a Suggest Only link, which holds them on every visit.
                  const pinned = review.pins.some(
                    (p) => p.key === person.key && review.links.includes(p.code),
                  );
                  const on = pinned || review.people.some((p) => p.key === person.key);
                  return (
                    <SwitchRow
                      key={person.key}
                      title={person.name || 'Guest'}
                      detail={
                        pinned
                          ? 'Suggest Only, from the Suggest Only link they opened'
                          : 'Suggest Only, through any Participant link'
                      }
                      checked={on}
                      busy={busy}
                      onChange={(next) =>
                        void save(
                          {
                            ...settings(review),
                            people: next
                              ? [...review.people, { key: person.key, name: person.name }]
                              : review.people.filter((p) => p.key !== person.key),
                            // Off lifts the pin too.
                            ...(next ? {} : { lift: [person.key] }),
                          },
                          next ? 'SuggestOnlyPersonOn' : 'SuggestOnlyPersonOff',
                        )
                      }
                    />
                  );
                })}
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
