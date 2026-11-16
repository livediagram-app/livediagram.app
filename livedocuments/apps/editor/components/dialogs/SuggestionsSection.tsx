'use client';

// The Share dialog's Suggestions section (docs/specs/007-editor/suggestions.md "Suggest Only"), livedocuments' own
// below Password Protection, for an Editor: Assistants Suggest first, then each Participant link and each person who
// has joined through one, each with a Suggest Only switch. A switch saves at once and reaches every open Participant;
// a refused save puts the switch back and says so.
import { useEffect, useId, useState } from 'react';
import type { ShareLink } from '@liveworkspace/index-client';
import type { ReviewSettings, StoredReview } from '@livedocuments/api-schema';
import { Switch } from '@livedocuments/ui';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { apiReadReview, apiSetReview } from '@/lib/api/review';
import { track } from '@/lib/telemetry';

const CARD =
  'divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-700/70 dark:border-slate-700 dark:bg-slate-800';
const ROW =
  'relative flex items-center gap-4 px-4 py-3 transition-colors duration-micro hover:bg-slate-50 dark:hover:bg-slate-700/40';
const GROUP =
  'px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

/** "Made 12 Nov", for a link's row. */
const madeOn = (at: number) =>
  `Made ${new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

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

export function SuggestionsSection({
  documentId,
  ownerId,
  shareCode,
  tabs,
  onError,
}: {
  documentId: string;
  ownerId: string;
  shareCode: string | null;
  // The document's tabs, to name a link that opens one.
  tabs: readonly { id: string; name: string }[];
  onError: (text: string) => void;
}) {
  const [review, setReview] = useState<StoredReview | null>(null);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.all([
      apiReadReview(ownerId, documentId, shareCode),
      indexClient.listShareLinks(documentId).catch(() => ({ links: [] as ShareLink[] })),
    ])
      .then(([r, l]) => {
        if (!live) return;
        setReview(r);
        setLinks(l.links.filter((x) => x.level === 'participate' && !x.public));
      })
      .catch(() => {
        if (live) onError('Could not read the suggestion settings.');
      });
    return () => {
      live = false;
    };
    // oxlint-disable-next-line react/exhaustive-deps -- read once as the dialog opens
  }, [documentId]);

  const save = async (next: ReviewSettings, event: string) => {
    if (!review) return;
    const before = review;
    setReview({ ...review, ...next });
    setBusy(true);
    try {
      setReview(await apiSetReview(ownerId, documentId, next, shareCode));
      track('Document', 'Shared', event);
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
    tabId === null ? 'Whole Document' : (tabs.find((t) => t.id === tabId)?.name ?? 'One Tab');

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
          <div className={CARD}>
            <SwitchRow
              title="Assistants Suggest"
              detail="An assistant’s edits to articles arrive as suggestions to accept or reject."
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
                  const on = review.people.some((p) => p.key === person.key);
                  return (
                    <SwitchRow
                      key={person.key}
                      title={person.name || 'Guest'}
                      detail="Suggest Only, through any Participant link"
                      checked={on}
                      busy={busy}
                      onChange={(next) =>
                        void save(
                          {
                            ...settings(review),
                            people: next
                              ? [...review.people, { key: person.key, name: person.name }]
                              : review.people.filter((p) => p.key !== person.key),
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
