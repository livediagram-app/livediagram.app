'use client';

// The repositories a connected plan hears (docs/specs/026-plan/automations.md "The GitHub view": Connected): each one
// the installation lists, a lock on a private one, and a switch for each the plan hears; Save Repositories while the
// picks differ from what is saved, up to 20. A private one picked says what that shares. The api checks each against
// the installation again; its refusals are said here in words, and one saying the list is out of date reads it again.

import { useId, useMemo, useState } from 'react';
import type { GithubConnectionView } from '@liveplanner/api-schema';
import { Button, LockIcon, Switch } from '@liveplanner/ui';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { AutomationsScope } from '../automations-client';
import { GithubRefusal, chooseGithubRepositories } from './github-client';
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
  const flip = (id: number, on: boolean) => {
    const next = new Set(picked);
    if (on) next.add(id);
    else next.delete(id);
    setPicked(next);
    setError(null);
  };
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
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={headingId} className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
          Repositories
        </h3>
        <span className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
          {picked.size} of {listed.length} heard
        </span>
      </div>
      {listed.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          The installation lists no repositories you can reach. Add some on GitHub with Change on
          GitHub.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
          {listed.map((r) => {
            const nameId = `${headingId}-${r.id}`;
            return (
              <li
                key={r.id}
                data-github-repository=""
                className="flex min-h-12 items-center gap-3 px-3.5 py-2"
              >
                <span
                  id={nameId}
                  className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-slate-800 dark:text-slate-100"
                >
                  <span className="truncate font-medium">{r.fullName}</span>
                  {r.private ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <LockIcon size={11} aria-hidden />
                      Private
                    </span>
                  ) : null}
                </span>
                <Switch
                  size="sm"
                  checked={picked.has(r.id)}
                  labelledBy={nameId}
                  disabled={saving}
                  onChange={(on) => flip(r.id, on)}
                />
              </li>
            );
          })}
        </ul>
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
