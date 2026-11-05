// The mint route's side of the server hearing check (docs/specs/012-collaboration/meeting-rooms-and-stage.md
// "Trust"; proximity-audio.md "The mint route", #483): ask the room which of a subscribe's tracks the caller may hear,
// subscribe only those, and answer the rest `not_heard` in their place, in the order asked. A room that cannot answer
// refuses nobody: the check never silences a call by failing.
import {
  CALL_NOT_HEARD,
  type CallSubscribeLocator,
  type CallTrackResult,
  type CallTracksResponse,
} from '@livehuddle/api-schema';
import type { HearingAnswer, HearingAsk } from './room-calls';

/** Asks the room; may throw or time out. */
export type HearingAsker = (asks: HearingAsk[]) => Promise<HearingAnswer[]>;

/** The locators the room let through, and each refused one's place in the request. */
export type HearingSplit = {
  allowed: CallSubscribeLocator[];
  refused: ReadonlySet<number>;
};

/** Which of `locators` the room says the caller may receive now. */
export async function splitByHearing(
  locators: readonly CallSubscribeLocator[],
  ask: HearingAsker,
): Promise<HearingSplit> {
  let answers: HearingAnswer[] | null = null;
  try {
    answers = await ask(locators.map((l) => ({ sessionId: l.sessionId, trackName: l.trackName })));
  } catch (error) {
    console.warn('[calls] hearing unanswered', String(error));
  }
  const refused = new Set<number>();
  const allowed: CallSubscribeLocator[] = [];
  locators.forEach((locator, i) => {
    const answer = answers?.[i] ?? 'heard';
    if (answer === 'heard') {
      allowed.push(locator);
      return;
    }
    console.warn('[calls] not heard', answer, locator.trackName);
    refused.add(i);
  });
  return { allowed, refused };
}

/** Realtime's answer for the allowed tracks, with a `not_heard` result put back in each refused one's place. */
export function withRefusals(
  locators: readonly CallSubscribeLocator[],
  refused: ReadonlySet<number>,
  answer: CallTracksResponse | null,
): CallTracksResponse {
  const tracks: CallTrackResult[] = [];
  let next = 0;
  locators.forEach((locator, i) => {
    if (refused.has(i)) {
      tracks.push({
        sessionId: locator.sessionId,
        trackName: locator.trackName,
        errorCode: CALL_NOT_HEARD,
      });
      return;
    }
    tracks.push(answer?.tracks[next++] ?? {});
  });
  return {
    ...(answer?.sessionDescription ? { sessionDescription: answer.sessionDescription } : {}),
    requiresImmediateRenegotiation: answer?.requiresImmediateRenegotiation ?? false,
    tracks,
  };
}
