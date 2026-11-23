'use client';

// Asking for approval, on the Share dialog's Approval tab (approvals.md "In the editor"): Approvers, a checklist of
// whom the Editor may name (a filter field once there are more than eight), an optional Note and Due day, Save this
// version as a snapshot where the editor offers Snapshots, and Request Approval, off until someone is ticked.

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  APPROVAL_NOTE_MAX,
  APPROVERS_MAX,
  IndexError,
  type Approval,
} from '@liveworkspace/index-client';
import { Button, Chip, DateInput, PictureDisc, TextArea, TextInput } from '@liveworkspace/ui';
import { SECTION_LABEL } from '../dialogs/share/parts';
import { initials } from '../library/person-name';
import { personName } from './approval-words';
import { filterNameable, mergeNameable, VIA_WORDS, type Nameable } from './approval-people';
import type { ApprovalContext } from './door';
import { Callout } from '@liveworkspace/ui/callout';

// More people than this, and the list grows a filter field.
const FILTER_AFTER = 8;

/** A refusal in the dialog's words. */
export function requestErrorWords(err: unknown, noun: string): string {
  const code = err instanceof IndexError ? err.code : null;
  if (code === 'approver_cannot_open') return `Someone you picked can no longer open this ${noun}.`;
  if (code === 'rate_limited')
    return `This ${noun} has had many requests today. Try again tomorrow.`;
  if (code === 'approvals_unavailable') return 'Couldn’t check who can open it. Try again.';
  if (code === 'forbidden') return `Only an Editor of the whole ${noun} can ask for approval.`;
  return 'Couldn’t ask for approval. Try again.';
}

type People = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; people: Nameable[] };

function usePeople(ctx: ApprovalContext): [People, () => void] {
  const { client, itemId, share, viewerId, loadTeamPeople } = ctx.door;
  const [people, setPeople] = useState<People>({ state: 'loading' });
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let live = true;
    setPeople({ state: 'loading' });
    // A team the host can't read leaves the owner and link visitors; the index's list failing is a failed read.
    const team = loadTeamPeople ? loadTeamPeople().catch(() => []) : Promise.resolve([]);
    Promise.all([team, client.approvalPeople(itemId, share)])
      .then(([members, { people: others }]) => {
        if (live) setPeople({ state: 'ready', people: mergeNameable(members, others, viewerId) });
      })
      .catch(() => {
        if (live) setPeople({ state: 'failed' });
      });
    return () => {
      live = false;
    };
  }, [client, itemId, share, viewerId, loadTeamPeople, tries]);
  return [people, useCallback(() => setTries((n) => n + 1), [])];
}

export function ApprovalForm({
  ctx,
  replacing,
  onDone,
  onBack,
}: {
  ctx: ApprovalContext;
  replacing: boolean;
  onDone: (approval: Approval) => void;
  onBack: (() => void) | null;
}) {
  const { door } = ctx;
  const [people, retry] = usePeople(ctx);
  const [ticked, setTicked] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [due, setDue] = useState<string | undefined>(undefined);
  const [snapshot, setSnapshot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { list: useId(), filter: useId(), note: useId(), due: useId(), snap: useId() };
  const all = people.state === 'ready' ? people.people : [];
  const shown = useMemo(() => filterNameable(all, query), [all, query]);
  const full = ticked.length >= APPROVERS_MAX;

  const toggle = (id: string) =>
    setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  const submit = async () => {
    if (ticked.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    let snapshotId: string | null = null;
    if (snapshot && door.takeSnapshot) {
      try {
        snapshotId = await door.takeSnapshot();
      } catch {
        setError('Couldn’t save the snapshot. Untick it to ask without one.');
        setBusy(false);
        return;
      }
    }
    try {
      const { approval } = await door.client.requestApproval(
        door.itemId,
        { approverIds: ticked, note: note.trim() || null, due: due ?? null, snapshotId },
        door.share,
      );
      onDone(approval);
    } catch (err) {
      setError(requestErrorWords(err, door.noun));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {replacing ? (
        <Callout tone="warning">
          A new request replaces the open one. Answers to it stay in History.
        </Callout>
      ) : null}
      <section aria-labelledby={ids.list} className="flex flex-col gap-2">
        <h3 id={ids.list} className={`${SECTION_LABEL} flex items-center justify-between`}>
          Approvers
          {ticked.length > 0 ? (
            <span className="normal-case tracking-normal text-slate-500 dark:text-slate-400">
              {ticked.length} picked{full ? ` (at most ${APPROVERS_MAX})` : ''}
            </span>
          ) : null}
        </h3>
        {people.state === 'loading' ? (
          <PlaceholderRows />
        ) : people.state === 'failed' ? (
          <p className="flex items-center justify-between gap-3 text-sm text-rose-700 dark:text-rose-300">
            Couldn’t load who can open it.
            <Button variant="secondary" size="xs" onClick={retry}>
              Try Again
            </Button>
          </p>
        ) : all.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Nobody else can open this {door.noun} yet. Share it, or move it to a team, to ask
            someone to approve it.
          </p>
        ) : (
          <>
            {all.length > FILTER_AFTER ? (
              <>
                <label htmlFor={ids.filter} className="sr-only">
                  Filter people
                </label>
                <TextInput
                  id={ids.filter}
                  compact
                  type="search"
                  value={query}
                  placeholder="Filter people"
                  onChange={(e) => setQuery(e.target.value)}
                />
              </>
            ) : null}
            <ul className="-mx-1 flex max-h-56 flex-col overflow-y-auto">
              {shown.length === 0 ? (
                <li className="px-1 py-2 text-xs text-slate-500 dark:text-slate-400">
                  Nobody matches “{query.trim()}”.
                </li>
              ) : (
                shown.map((p) => {
                  const on = ticked.includes(p.id);
                  const name = personName(p);
                  return (
                    <li key={p.id}>
                      <label
                        className={`flex min-h-11 items-center gap-3 rounded-lg px-1 py-1 sm:min-h-0 ${
                          !on && full
                            ? 'cursor-not-allowed opacity-50'
                            : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!on && full}
                          onChange={() => toggle(p.id)}
                          className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-400 dark:border-slate-600 dark:bg-slate-900"
                        />
                        <PictureDisc
                          aria-hidden
                          pictureUrl={null}
                          name={name}
                          size={24}
                          className="bg-brand-100 text-[10px] font-semibold text-brand-800 dark:bg-brand-500/20 dark:text-brand-200"
                        >
                          {initials(name) ?? '?'}
                        </PictureDisc>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100">
                          {name}
                        </span>
                        <Chip className="bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {VIA_WORDS[p.via]}
                        </Chip>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </>
        )}
      </section>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.note} className={SECTION_LABEL}>
          Note <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <TextArea
          id={ids.note}
          rows={2}
          value={note}
          maxLength={APPROVAL_NOTE_MAX}
          placeholder="What should they look at?"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.due} className={SECTION_LABEL}>
            Due <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <DateInput id={ids.due} compact value={due} onCommit={setDue} className="w-44" />
        </div>
        {door.takeSnapshot ? (
          <label
            htmlFor={ids.snap}
            className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700 sm:min-h-0 dark:text-slate-200"
          >
            <input
              id={ids.snap}
              type="checkbox"
              checked={snapshot}
              onChange={(e) => setSnapshot(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-400 dark:border-slate-600 dark:bg-slate-900"
            />
            Save this version as a snapshot
          </label>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        {onBack ? (
          <Button variant="ghost" size="sm" onClick={onBack}>
            Back
          </Button>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          size="sm"
          busy={busy}
          disabled={ticked.length === 0}
        >
          Request Approval
        </Button>
      </div>
    </form>
  );
}

/** Three quiet rows while a list loads. */
export function PlaceholderRows() {
  return (
    <ul aria-label="Loading" className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3">
          <span className="h-6 w-6 animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />
          <span className="h-3 flex-1 animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />
        </li>
      ))}
    </ul>
  );
}
