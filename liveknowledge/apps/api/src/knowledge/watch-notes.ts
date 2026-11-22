// A change to a page someone may watch, noted where it happens (docs/specs/030-knowledgebase/watching.md "What a
// watcher hears of"; blueprint watching.md "Noting a change"): folded into the page's open update, the changes of an
// hour from its first, so a page makes at most one Inbox row an hour. Nothing is told here: the room's alarm pushes
// the updates to the Inbox and sends the digests (watch-work.ts), never the request that made the change.
//
// A knowledgebase nobody watches pays one indexed read, and never asks who made the change.
import { UPDATE_ACTORS_MAX, type UpdateActor, type UpdateKind } from '@liveworkspace/index-client';
import { getParticipant } from '../person/profiles';
import type { DocumentEnv } from '../types';
import { knowledgeDb } from './knowledge-db';
import { anyWatch } from './page-watch';
import type { PageWriter } from './page-writer';

/** How long an update stays open to the page's next changes. */
export const WATCH_UPDATE_WINDOW_MS = 60 * 60 * 1000;
/** How long after a change the push to the Inbox runs: a burst of saves is one push. */
export const WATCH_PUSH_DELAY_MS = 60_000;
/** The most ids an update keeps of who changed the page (its own changes never tell a watcher). */
export const WATCH_ACTOR_IDS_MAX = 50;
/** The longest name an update keeps. */
const NAME_MAX = 80;

/** Who made a change: a person's id (an agent's is its token's person) and the name to show; null for nobody (a
 *  review that came due). */
export type WatchActor = UpdateActor | null;

export type WatchNote = {
  tabs: readonly string[];
  kind: UpdateKind;
  /** Asked only when the knowledgebase has a watch. */
  actor: () => Promise<WatchActor> | WatchActor;
  now?: number;
};

/** A person as an update names them: their profile's name, else `fallback`. Null for nobody. */
export const personActor =
  (env: DocumentEnv, id: string | null | undefined, fallback = 'Someone') =>
  async (): Promise<WatchActor> =>
    id ? { id, name: (await getParticipant(env, id))?.name || fallback } : null;

/** The writer of a save: an agent by its name (its token's person is who it acts for, so their own agent's change
 *  never tells them), a person by their profile's. */
export const writerActor = (env: DocumentEnv, writer: PageWriter) =>
  writer.kind === 'ai'
    ? () => ({ id: writer.by, name: writer.agent || 'An agent' })
    : personActor(env, writer.by);

type OpenUpdate = {
  id: string;
  kinds: string;
  actors: string;
  actor_ids: string;
  count: number;
};

const parsed = <T>(text: string, fallback: T): T => {
  try {
    const value = JSON.parse(text) as unknown;
    return Array.isArray(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
};

/** The update's fields with one more change folded in. Pure, for the note and its tests. */
export function foldChange(
  held: {
    kinds: readonly UpdateKind[];
    actors: readonly UpdateActor[];
    actorIds: readonly string[];
  },
  kind: UpdateKind,
  actor: WatchActor,
): { kinds: UpdateKind[]; actors: UpdateActor[]; actorIds: string[] } {
  const kinds = held.kinds.includes(kind) ? [...held.kinds] : [...held.kinds, kind];
  if (!actor) return { kinds, actors: [...held.actors], actorIds: [...held.actorIds] };
  const who = { id: actor.id, name: actor.name.trim().slice(0, NAME_MAX) || 'Someone' };
  const actors = [who, ...held.actors.filter((a) => a.id !== who.id)].slice(0, UPDATE_ACTORS_MAX);
  const actorIds = held.actorIds.includes(who.id)
    ? [...held.actorIds]
    : [...held.actorIds, who.id].slice(0, WATCH_ACTOR_IDS_MAX);
  return { kinds, actors, actorIds };
}

/** Note a change to each of these pages for their watchers. Never throws: a failure is logged and the write it
 *  follows stands. Answers whether anything was noted. */
export async function noteWatched(env: DocumentEnv, note: WatchNote): Promise<boolean> {
  if (note.tabs.length === 0) return false;
  try {
    if (!(await anyWatch(env))) return false;
    const now = note.now ?? Date.now();
    const actor = await note.actor();
    const db = knowledgeDb(env);
    for (const tab of new Set(note.tabs)) {
      const [open, named] = await db.batch<OpenUpdate | { name: string }>([
        db
          .prepare(
            `SELECT id, kinds, actors, actor_ids, count FROM watch_updates
              WHERE tab = ? AND first_at > ? ORDER BY first_at DESC LIMIT 1`,
          )
          .bind(tab, now - WATCH_UPDATE_WINDOW_MS),
        db.prepare('SELECT name FROM tabs WHERE id = ?').bind(tab),
      ]);
      const row = open?.results?.[0] as OpenUpdate | undefined;
      const name = ((named?.results?.[0] as { name?: string } | undefined)?.name ?? '').slice(
        0,
        200,
      );
      const next = foldChange(
        row
          ? {
              kinds: parsed<UpdateKind[]>(row.kinds, []),
              actors: parsed<UpdateActor[]>(row.actors, []),
              actorIds: parsed<string[]>(row.actor_ids, []),
            }
          : { kinds: [], actors: [], actorIds: [] },
        note.kind,
        actor,
      );
      const fields = [
        name,
        JSON.stringify(next.kinds),
        JSON.stringify(next.actors),
        JSON.stringify(next.actorIds),
      ];
      if (row)
        await db
          .prepare(
            `UPDATE watch_updates SET tab_name = ?, kinds = ?, actors = ?, actor_ids = ?, count = count + 1,
               latest_at = ? WHERE id = ?`,
          )
          .bind(...fields, now, row.id)
          .run();
      else
        await db
          .prepare(
            `INSERT OR IGNORE INTO watch_updates
               (id, tab, tab_name, kinds, actors, actor_ids, count, first_at, latest_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          )
          .bind(`${tab}:${now}`, tab, ...fields, now, now)
          .run();
    }
    env.WATCH_OWED?.('inbox', now + WATCH_PUSH_DELAY_MS);
    console.info('[watch] noted', { kind: note.kind, pages: note.tabs.length });
    return true;
  } catch (error) {
    console.warn('[watch] note failed', { kind: note.kind, error: String(error) });
    return false;
  }
}
