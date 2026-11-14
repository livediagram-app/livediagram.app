// Where an item stands, told to its app (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Where an item
// stands"): after the batch that archives an item, moves it out of Archived, sends it to the Trash or restores it, the
// app hears `{archived, trashed, at}` off the request's path, so work it does on its own clock for the item (liveplanner's
// time rules, Waits and repeating cards) stops while it is put away. Pushed, never asked: a wake costs the index nothing.
// A call that can't be delivered is tried once more about a second later, in the same waitUntil; one still undelivered is
// logged and dropped, and the app runs the item as before (fails open) and takes the next grant signed for it as its standing.

import { itemStandingPath, type App, type ItemStanding } from '@liveworkspace/index-client';
import { callApp } from './app-calls';
import type { Env } from './env';

/** The pause before the one retry of a standing call that failed. */
export const STANDING_RETRY_MS = 1_000;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function deliver(env: Env, app: App, id: string, standing: ItemStanding): Promise<void> {
  let res = await callApp(env, app, 'POST', itemStandingPath(id), standing);
  if (!res.ok) {
    // One bounded retry: a lost restore would leave the plan's rules paused until the next grant.
    await pause(STANDING_RETRY_MS);
    res = await callApp(env, app, 'POST', itemStandingPath(id), standing);
  }
  if (!res.ok) console.warn('[index] standing not delivered', { app, error: res.error });
}

/** Tells `app` where item `id` stands now, in the background. */
export function tellStanding(
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void,
  app: App,
  id: string,
  standing: ItemStanding,
): void {
  waitUntil(deliver(env, app, id, standing));
}
