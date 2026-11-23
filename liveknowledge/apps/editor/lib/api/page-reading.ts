// Required Reading from the editor (docs/specs/030-knowledgebase/required-reading.md): one request each through the
// knowledge funnel (lib/api/knowledge.ts), the refusals the interface words itself kept out of the failure report.
import type {
  PageReadingChange,
  PageReadingResponse,
  ReadingRemindResult,
} from '@liveknowledge/api-schema';
import { apiFetch, expectOk } from './core';
import { knowledgeHeaders, knowledgeSignal, knowledgeUrl, type KnowledgeCaller } from './knowledge';

const EXPECTED = new Set([
  'forbidden',
  'invalid_change',
  'too_many_people',
  'reading_pages_full',
  'reading_needs_account',
  'not_required',
  'not_asked',
  'reading_too_fast',
]);
const expected = (code: string | null) => code !== null && EXPECTED.has(code);

const pageUrl = (documentId: string, tab: string, path: string) =>
  knowledgeUrl(documentId, `pages/${encodeURIComponent(tab)}/${path}`);

/** The page's requirement, the caller's own state and the counts (names too, for an Editor or the page's owner). */
export async function apiPageReading(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  signal?: AbortSignal,
): Promise<PageReadingResponse> {
  const res = await apiFetch(pageUrl(documentId, tab, 'reading'), {
    headers: await knowledgeHeaders(who),
    signal: knowledgeSignal(signal),
  });
  return expectOk<PageReadingResponse>(res, 'read required reading', expected);
}

/** Require the page for everyone or chosen people, or stop (`audience: null`). An Editor's. */
export async function apiSetPageReading(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  change: PageReadingChange,
): Promise<PageReadingResponse> {
  const res = await apiFetch(pageUrl(documentId, tab, 'reading'), {
    method: 'PUT',
    headers: await knowledgeHeaders(who, true),
    body: JSON.stringify(change),
    signal: knowledgeSignal(),
  });
  return expectOk<PageReadingResponse>(res, 'set required reading', expected);
}

export type ReadingPress = 'read' | 'read-again';

/** I've Read This (`read`), or ask everyone again (`read-again`, an Editor's). Answers the page's state as stored. */
export async function apiPressReading(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
  press: ReadingPress,
): Promise<PageReadingResponse> {
  const res = await apiFetch(pageUrl(documentId, tab, press), {
    method: 'POST',
    headers: await knowledgeHeaders(who, true),
    body: '{}',
    signal: knowledgeSignal(),
  });
  return expectOk<PageReadingResponse>(
    res,
    press === 'read' ? 'confirm read' : 'ask again',
    expected,
  );
}

/** Email each person not yet read, at most once a week each. An Editor's or the page's owner's. */
export async function apiRemindReaders(
  who: KnowledgeCaller,
  documentId: string,
  tab: string,
): Promise<ReadingRemindResult> {
  const res = await apiFetch(pageUrl(documentId, tab, 'remind-readers'), {
    method: 'POST',
    headers: await knowledgeHeaders(who, true),
    body: '{}',
    signal: knowledgeSignal(),
  });
  return expectOk<ReadingRemindResult>(res, 'remind readers', expected);
}
