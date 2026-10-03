'use client';

// One What happened entry (docs/specs/013-workspace/explorer-home.md "What happened"). A group
// with one person shows that person's actions, each a link that opens the document. A group with
// several people collapses into one summary: a disclosure button whose sentence names everyone
// and everything, expanding (collapsed by default, never remembered) to every action, newest first.

import { useId, useState } from 'react';
import type { HomeAction, HomeGroup } from '@livediagram/api-schema';
import { track } from '@/lib/telemetry';
import {
  actionDetail,
  actionPhrase,
  clockTime,
  locationLabel,
  personName,
  summarySentence,
  updatesLabel,
  VERB_PHRASES,
} from '@/app/explorer/home/home-copy';
import { homeDocumentHref } from '@/app/explorer/home/home-model';
import { AvatarStack, HomeAvatar } from './HomeAvatar';
import { ChevronGlyph, VerbGlyph } from './home-icons';
import { FOCUS_RING, MUTED, ROW } from './home-styles';

const openFromFeed = () => track('Home', 'Selected', 'WhatHappened');

/** One person's action: who, what, which document, where it lives, when. */
export function ActionEntry({ group, action }: { group: HomeGroup; action: HomeAction }) {
  const person = group.people.find((p) => p.id === action.personId);
  const detail = actionDetail(action);
  return (
    <li>
      <a
        href={homeDocumentHref(group)}
        onClick={openFromFeed}
        className={`flex items-start gap-3 ${ROW} ${FOCUS_RING}`}
      >
        <HomeAvatar person={person} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-slate-700 dark:text-slate-300">
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              {personName(person)}
            </strong>{' '}
            {actionPhrase(action.verb)}{' '}
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              {group.name}
            </strong>
          </span>
          {detail ? (
            <span className={`mt-0.5 block truncate text-xs ${MUTED}`}>{detail}</span>
          ) : null}
          <span className={`mt-0.5 block truncate text-xs ${MUTED}`}>{locationLabel(group)}</span>
        </span>
        <time
          dateTime={new Date(action.occurredAt).toISOString()}
          className={`shrink-0 text-xs tabular-nums ${MUTED}`}
        >
          {clockTime(action.occurredAt)}
        </time>
      </a>
    </li>
  );
}

/** Several people's actions on one document in one day: a summary that expands. */
export function SummaryEntry({ group }: { group: HomeGroup }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const sentence = summarySentence(group);
  return (
    <li>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => {
          if (!expanded) track('Home', 'Opened', 'Group');
          setExpanded(!expanded);
        }}
        className={`flex w-full items-start gap-3 text-left ${ROW} ${FOCUS_RING}`}
      >
        <AvatarStack people={group.people} size={24} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-slate-700 dark:text-slate-300">
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              {sentence.people}
            </strong>{' '}
            {sentence.verbs}
            {sentence.preposition ? ` ${sentence.preposition}` : ''}{' '}
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              {sentence.document}
            </strong>
          </span>
          <span className={`mt-0.5 block truncate text-xs ${MUTED}`}>
            {locationLabel(group)} · {updatesLabel(group.total)}
          </span>
        </span>
        <span className={`flex shrink-0 items-center gap-1 text-xs tabular-nums ${MUTED}`}>
          <time dateTime={new Date(group.latestAt).toISOString()}>{clockTime(group.latestAt)}</time>
          <span
            aria-hidden
            className={`motion-safe:transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <ChevronGlyph />
          </span>
        </span>
      </button>
      <ul id={listId} hidden={!expanded} className="ml-9 mt-1 flex flex-col gap-0.5">
        {expanded
          ? group.actions.map((action) => {
              const person = group.people.find((p) => p.id === action.personId);
              return (
                <li key={action.id}>
                  <a
                    href={homeDocumentHref(group)}
                    onClick={openFromFeed}
                    aria-label={`${personName(person)} ${VERB_PHRASES[action.verb]}, ${group.name}, ${clockTime(action.occurredAt)}`}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800/70 ${FOCUS_RING}`}
                  >
                    <HomeAvatar person={person} size={20} />
                    <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">
                      <strong className="font-semibold text-slate-900 dark:text-slate-100">
                        {personName(person)}
                      </strong>{' '}
                      {VERB_PHRASES[action.verb]}
                    </span>
                    <span aria-hidden className={MUTED}>
                      <VerbGlyph verb={action.verb} />
                    </span>
                    <time
                      dateTime={new Date(action.occurredAt).toISOString()}
                      className={`shrink-0 text-xs tabular-nums ${MUTED}`}
                    >
                      {clockTime(action.occurredAt)}
                    </time>
                  </a>
                </li>
              );
            })
          : null}
      </ul>
    </li>
  );
}
