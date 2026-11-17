// What walkthroughs count (liveworkspace/docs/specs/006-media/walkthroughs.md "Telemetry"), through the product's own
// `track` the workbench binds: a recording started, saved, thrown away or refused by a limit, and a walkthrough played
// or deleted. Anonymous and closed: never a title, an id, a length or a size, only which of these happened and, for a
// refusal, which limit.

import { workbench } from '@liveworkspace/workbench/bindings';

/** The limits a walkthrough can meet, as `Walkthrough·Refused` names them. */
export type WalkthroughLimit = 'TooLong' | 'TooLarge' | 'ItemFull' | 'AccountFull';

// The api's refusal codes that are a limit (walkthroughRefusalMessage), and the token each counts under.
const LIMIT_OF_ERROR: ReadonlyMap<string, WalkthroughLimit> = new Map([
  ['too_long', 'TooLong'],
  ['file_too_large', 'TooLarge'],
  ['item_full', 'ItemFull'],
  ['walkthroughs_full', 'AccountFull'],
]);

/** The limit an api refusal is, or null for any other refusal (a forbidden caller, an unsupported type, an outage). */
export function limitOfRefusal(error: unknown): WalkthroughLimit | null {
  return typeof error === 'string' ? (LIMIT_OF_ERROR.get(error) ?? null) : null;
}

export const walkthroughTelemetry = {
  recordingStarted: () => workbench.track('Walkthrough', 'Started'),
  saved: () => workbench.track('Walkthrough', 'Created'),
  abandoned: () => workbench.track('Walkthrough', 'Abandoned'),
  refused: (limit: WalkthroughLimit) => workbench.track('Walkthrough', 'Refused', limit),
  played: () => workbench.track('Walkthrough', 'Played'),
  deleted: () => workbench.track('Walkthrough', 'Deleted'),
};
