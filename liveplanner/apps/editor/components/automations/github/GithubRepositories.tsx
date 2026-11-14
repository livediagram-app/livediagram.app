'use client';

// The repositories a connected plan hears (docs/specs/026-plan/automations.md "The GitHub view": Connected): each one
// the installation lists, a lock on a private one, and a switch for each the plan hears; Save Repositories while the
// picks differ from what is saved, up to 20. A private one picked says what that shares. The api checks each against
// the installation again; its refusals are said here in words, and one saying the list is out of date reads it again.
// With more than 20 listed (up to 1,000), Search Repositories narrows the list and the rows draw in a window of their
// own (RepositoryWindow.tsx), so a long list opens, scrolls and filters without a pause.

import { useCallback, useId, useMemo, useState } from 'react';
import type { GithubConnectionView, GithubRepositoryView } from '@liveplanner/api-schema';
import { Button, NoMatches, SearchIcon, TextInput } from '@liveplanner/ui';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { AutomationsScope } from '../automations-client';
import { GithubRefusal, chooseGithubRepositories } from './github-client';
import {
  REPOSITORY_BOX_CLASSES,
  REPOSITORY_LIST_CLASSES,
  RepositoryRow,
  RepositoryWindow,
} from './RepositoryWindow';
import { loadGithub, setGithub } from './use-github-connection';

/** The most repositories one plan hears (the api's REPOSITORIES_MAX). */
export const GITHUB_REPOSITORIES_MAX = 20;

const CHOOSE_WORDS: Readonly<Record<string, string>> = {
  github_repository_full: 'One of these repositories already sends to 20 plans, the most it can.',
  github_repository_gone:
    'One of these repositories left the installation on GitHub. The list is read again: check your picks and save.',
  github_invalid:
    'The repositories changed on GitHub. The list is read again: check your picks and save.',
  github_unavailable: 'GitHub didn’t answer. Try again in a moment.',
  github_needs_editor: 'Only an Editor signed in can change which repositories this plan hears.',
  github_not_connected: 'This plan was disconnected from GitHub elsewhere.',
};

// Refusals that mean the listing is out of date.
const STALE: ReadonlySet<string> = new Set([
  'github_repository_gone',
  'github_invalid',
  'github_not_connected',
]);

const sameSet = (a: ReadonlySet<number>, b: ReadonlySet<number>) =>
  a.size === b.size && [...a].every((id) => b.has(id));

/** The repositories whose `owner/name` holds the words, any case; every one for none. One pass. */
export function repositoriesMatching(
  repositories: readonly GithubRepositoryView[],
  query: string,
): readonly GithubRepositoryView[] {
  const q = query.trim().toLowerCase();
  return q ? repositories.filter((r) => r.fullName.toLowerCase().includes(q)) : repositories;
}

const byName = (a: GithubRepositoryView, b: GithubRepositoryView) =>
  a.fullName.localeCompare(b.fullName, 'en', { sensitivity: 'base', numeric: true });

/**
 * A long list's order: the ones the plan hears (as saved, so a row never jumps while it is flipped) pinned first, then
 * the rest, each part by name. One sort.
 */
export function pinnedFirst(
  repositories: readonly GithubRepositoryView[],
): readonly GithubRepositoryView[] {
  return [...repositories].sort((a, b) => Number(b.chosen) - Number(a.chosen) || byName(a, b));
}

const count = (n: number) => n.toLocaleString('en-GB');

export function GithubRepositories({
  scope,
  connection,
  phone,
}: {
  scope: AutomationsScope;
  connection: GithubConnectionView;
  phone: boolean;
}) {
  const headingId = useId();
  const saved = useMemo(
    () => new Set(connection.repositories.filter((r) => r.chosen).map((r) => r.id)),
    [connection],
  );
  const [held, setPicked] = useState<ReadonlySet<number>>(saved);
  // Only the repositories listed count: one gone since it was picked (the list read again) has no switch to unpick.
  const picked = useMemo(
    () => new Set(connection.repositories.filter((r) => held.has(r.id)).map((r) => r.id)),
    [connection, held],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = !sameSet(picked, saved);
  const over = picked.size > GITHUB_REPOSITORIES_MAX;
  const privatePicked = connection.repositories.some((r) => r.private && picked.has(r.id));
  // Stable, so a flip redraws only the row it flips (RepositoryRow is memoised).
  const flip = useCallback((id: number, on: boolean) => {
    setPicked((held) => {
      const next = new Set(held);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    setError(null);
  }, []);
  const [query, setQuery] = useState('');
  const save = async () => {
    if (saving || over) return;
    setSaving(true);
    setError(null);
    try {
      const next = await chooseGithubRepositories(scope, [...picked]);
      setGithub(scope, next);
    } catch (e) {
      debugLog('[github] choose.failed', { error: String(e) });
      setError(
        (e instanceof GithubRefusal ? CHOOSE_WORDS[e.code] : undefined) ??
          'The repositories didn’t save. Check your connection and try again.',
      );
      // The list (or the connection) changed elsewhere: read it again, so the switches are the installation's.
      if (e instanceof GithubRefusal && STALE.has(e.code)) void loadGithub(scope);
    } finally {
      setSaving(false);
    }
  };
  const listed = connection.repositories;
  const long = listed.length > GITHUB_REPOSITORIES_MAX;
  // Pinned first, sorted once per listing; a search keeps that order, so a heard one shows first only if it matches.
  const ordered = useMemo(() => (long ? pinnedFirst(listed) : listed), [listed, long]);
  const matching = useMemo(
    () => (long ? repositoriesMatching(ordered, query) : ordered),
    [ordered, long, query],
  );
  const searching = long && query.trim().length > 0;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={headingId} className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
          Repositories
        </h3>
        <span className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
          {searching
            ? `${count(matching.length)} of ${count(listed.length)} shown`
            : `${picked.size} of ${count(listed.length)} heard`}
        </span>
      </div>
      {long ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon size={14} />
          </span>
          <TextInput
            compact
            type="search"
            aria-label="Search Repositories"
            placeholder="Search repositories"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      ) : null}
      {listed.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          The installation lists no repositories you can reach. Add some on GitHub with Change on
          GitHub.
        </p>
      ) : !long ? (
        <ul className={`${REPOSITORY_BOX_CLASSES} ${REPOSITORY_LIST_CLASSES}`}>
          {listed.map((r) => (
            <RepositoryRow
              key={r.id}
              repository={r}
              picked={picked.has(r.id)}
              saving={saving}
              onFlip={flip}
              nameId={`${headingId}-${r.id}`}
            />
          ))}
        </ul>
      ) : matching.length === 0 ? (
        <NoMatches things="repositories" query={query} onClear={() => setQuery('')} />
      ) : (
        // A new search starts at the top of its matches.
        <RepositoryWindow
          key={query.trim().toLowerCase()}
          repositories={matching}
          picked={picked}
          saving={saving}
          onFlip={flip}
          phone={phone}
          idPrefix={headingId}
          label="Repositories"
        />
      )}
      {picked.size === 0 && listed.length > GITHUB_REPOSITORIES_MAX && !dirty ? (
        <p className="text-[12px] text-slate-600 dark:text-slate-300">
          Pick up to 20 repositories for this plan to hear.
        </p>
      ) : null}
      {privatePicked ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          Anyone who can see this plan’s cards, share links included, sees these pull requests’
          titles and states.
        </p>
      ) : null}
      {over ? (
        <p role="alert" className="text-[12px] font-medium text-red-700 dark:text-red-300">
          Pick up to 20.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[12px] font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {dirty ? (
        <div className={`flex gap-2 ${phone ? 'flex-col-reverse' : 'justify-end'}`}>
          <Button variant="secondary" size="xs" disabled={saving} onClick={() => setPicked(saved)}>
            Undo Changes
          </Button>
          <Button variant="primary" size="xs" disabled={saving || over} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save Repositories'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
