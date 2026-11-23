// Required Reading on a page (docs/specs/030-knowledgebase/required-reading.md; blueprint required-reading.md):
//   GET  /api/documents/<id>/pages/<tab>/reading         the requirement, the caller's own state and the counts
//   PUT  /api/documents/<id>/pages/<tab>/reading         { audience, people? }: require, change or stop (an Editor)
//   POST /api/documents/<id>/pages/<tab>/read            I've Read This (a signed-in person who is asked)
//   POST /api/documents/<id>/pages/<tab>/read-again      ask everyone again (an Editor)
//   POST /api/documents/<id>/pages/<tab>/remind-readers  email those not yet read (an Editor or the page's owner)
// Each is one segment under the page, as every page route is (the route-parity probe walks each depth).
// Reading is every role's. Who has read it is an Editor's and the page's owner's alone: every other answer carries
// counts and the caller's own state, never a name or an id. None of it is an edit.
import { isAccountId } from '@liveworkspace/auth-client';
import {
  isReadingAudience,
  READING_CHANGES_PER_MINUTE,
  READING_LIST_MAX,
  READING_PEOPLE_MAX,
  type PageReadingChange,
  type PageReadingPerson,
  type PageReadingResponse,
  type ReadingAudience,
} from '@liveknowledge/api-schema';
import { parseKnowledgeFields } from '@liveknowledge/knowledge';
import { emailEnabled } from '../email/client';
import { pageCreatorOf, readerOf } from '../knowledge/knowledge-caller';
import {
  askAgain,
  clearRequirement,
  confirmationsOf,
  confirmRead,
  requirementOf,
  setRequirement,
  type Requirement,
} from '../knowledge/page-reading';
import { audienceOf, namesOf } from '../knowledge/reading-people';
import { remindedOf, remindReaders } from '../knowledge/reading-remind';
import { getParticipant } from '../person/profiles';
import { json, methodNotAllowed } from '../responses';
import type { DocumentDTO } from '../types';
import type { DocumentAccess, DocumentRouteContext } from './context';
import { createReactionRate } from './knowledge-reaction-routes';

type Refusal =
  | 'forbidden'
  | 'invalid_change'
  | 'too_many_people'
  | 'reading_pages_full'
  | 'reading_needs_account'
  | 'not_required'
  | 'not_asked'
  | 'reading_too_fast';

const REFUSALS: Record<Refusal, { status: number; message: string }> = {
  forbidden: { status: 403, message: 'Only an Editor, signed in, may change Required Reading.' },
  invalid_change: {
    status: 400,
    message:
      'Send one change: { "audience": "everyone" } or { "audience": "people", "people": ["user_..."] }, or { "audience": null } to stop.',
  },
  too_many_people: {
    status: 400,
    message: `A page can be Required Reading for at most ${READING_PEOPLE_MAX} chosen people.`,
  },
  reading_pages_full: {
    status: 409,
    message: 'This knowledgebase holds as many Required Reading pages as it can.',
  },
  reading_needs_account: {
    status: 403,
    message: 'Sign in to confirm you read a page. Guests and agents do not confirm.',
  },
  not_required: { status: 409, message: 'This page is not Required Reading.' },
  not_asked: { status: 409, message: 'This page is not Required Reading for you.' },
  reading_too_fast: { status: 429, message: 'Too many changes in a minute. Try again shortly.' },
};

const refused = (code: Refusal) =>
  json({ error: code, message: REFUSALS[code].message }, { status: REFUSALS[code].status });

/** The body as a change, or a refusal. Chosen ids are deduplicated. */
export function parseReadingChange(
  body: unknown,
): { audience: ReadingAudience | null; people: string[] } | 'invalid_change' | 'too_many_people' {
  if (!body || typeof body !== 'object' || !Object.hasOwn(body, 'audience'))
    return 'invalid_change';
  const { audience, people } = body as PageReadingChange;
  if (audience === null) return { audience: null, people: [] };
  if (!isReadingAudience(audience)) return 'invalid_change';
  if (audience === 'everyone') return { audience, people: [] };
  if (!Array.isArray(people) || people.length === 0) return 'invalid_change';
  if (!people.every((id) => typeof id === 'string' && isAccountId(id))) return 'invalid_change';
  const unique = [...new Set(people)];
  if (unique.length > READING_PEOPLE_MAX) return 'too_many_people';
  return { audience, people: unique };
}

const rate = createReactionRate(READING_CHANGES_PER_MINUTE);

/** The page segments this file answers. */
export const READING_PATHS: ReadonlySet<string> = new Set([
  'reading',
  'read',
  'read-again',
  'remind-readers',
]);

/** A person signed in, in person: never a guest, a link visitor without an account, or an agent's token. */
const personOf = (ctx: DocumentRouteContext): string | null => {
  const person = pageCreatorOf(ctx);
  return person && isAccountId(person) && readerOf(ctx).kind === 'person' ? person : null;
};

const ownerOfPage = (document: DocumentDTO, tab: string) =>
  parseKnowledgeFields(document.tabs.find((t) => t.id === tab)?.knowledge).owner;

/** What the caller is told of the page. Names only for whoever `sees`. */
async function answerOf(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  grant: DocumentAccess,
  tab: string,
  requirement: Requirement | null,
): Promise<PageReadingResponse> {
  const person = personOf(ctx);
  const manages = person !== null && grant.role === 'edit';
  const sees = manages || (person !== null && ownerOfPage(document, tab) === person);
  const email = emailEnabled(ctx.env);
  if (!requirement)
    return { required: null, mine: { asked: false }, progress: null, sees, manages, email };
  const now = Date.now();
  const confirmations = await confirmationsOf(ctx.env, tab);
  const audience = await audienceOf(ctx.env, document, requirement, confirmations.keys(), now);
  const counted = new Set(audience.ids);
  const done = audience.ids.filter((id) => confirmations.has(id)).length;
  const asked = person !== null && (requirement.audience === 'everyone' || counted.has(person));
  const readAt = person ? confirmations.get(person) : undefined;
  const answer: PageReadingResponse = {
    required: {
      audience: requirement.audience,
      askedAt: requirement.askedAt,
      round: requirement.round,
    },
    mine: asked && readAt !== undefined ? { asked, readAt } : { asked },
    progress: { done, total: audience.ids.length },
    sees,
    manages,
    email,
  };
  if (manages && requirement.audience === 'people') answer.chosen = [...requirement.people];
  if (!sees) return answer;
  const listed = [
    ...audience.ids.filter((id) => !confirmations.has(id)),
    ...audience.ids
      .filter((id) => confirmations.has(id))
      .sort((a, b) => confirmations.get(b)! - confirmations.get(a)!),
  ].slice(0, READING_LIST_MAX);
  const [names, reminded] = await Promise.all([
    namesOf(ctx.env, listed, audience.names),
    remindedOf(ctx.env, tab),
  ]);
  answer.people = listed.map((id): PageReadingPerson => {
    const read = confirmations.get(id);
    const remind = reminded.get(id);
    return {
      id,
      name: names.get(id) ?? 'Someone',
      ...(read !== undefined ? { readAt: read } : {}),
      ...(remind !== undefined ? { remindedAt: remind } : {}),
    };
  });
  const last = Math.max(0, ...[...reminded.values()]);
  if (last > 0) answer.remindedAt = last;
  return answer;
}

/** The page's people not yet read, for Remind. */
async function pendingOf(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  tab: string,
  requirement: Requirement,
): Promise<string[]> {
  const confirmations = await confirmationsOf(ctx.env, tab);
  const audience = await audienceOf(
    ctx.env,
    document,
    requirement,
    confirmations.keys(),
    Date.now(),
  );
  return audience.ids.filter((id) => !confirmations.has(id));
}

export async function handlePageReading(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  grant: DocumentAccess,
  tab: string,
  segment: string,
): Promise<Response> {
  const { request, env } = ctx;
  const method = request.method;
  const action =
    segment === 'read'
      ? 'confirm'
      : segment === 'read-again'
        ? 'again'
        : segment === 'remind-readers'
          ? 'remind'
          : undefined;
  if (action === undefined && method !== 'GET' && method !== 'PUT') return methodNotAllowed();
  if (action !== undefined && method !== 'POST') return methodNotAllowed();
  const requirement = await requirementOf(env, tab);
  if (action === undefined && method === 'GET')
    return json(await answerOf(ctx, document, grant, tab, requirement));
  const person = personOf(ctx);
  const now = Date.now();
  if (action === 'confirm') {
    if (!person) return refused('reading_needs_account');
    if (!requirement) return refused('not_required');
    if (requirement.audience === 'people' && !requirement.people.includes(person))
      return refused('not_asked');
    if (!rate.take(`${document.id}\u0000${person}`, now)) return refused('reading_too_fast');
    await confirmRead(env, tab, person, now);
    console.info('[reading] confirmed', { documentId: document.id, tabId: tab });
    return json(await answerOf(ctx, document, grant, tab, requirement));
  }
  if (action === 'remind') {
    const owner = person !== null && ownerOfPage(document, tab) === person;
    if (!person || (grant.role !== 'edit' && !owner)) return refused('forbidden');
    if (!requirement) return refused('not_required');
    const pending = await pendingOf(ctx, document, tab, requirement);
    const title = document.tabs.find((t) => t.id === tab)?.name ?? '';
    const from = (await getParticipant(env, person))?.name ?? '';
    return json(await remindReaders(env, document, { tab, title }, pending, from, now));
  }
  // Requiring, changing, stopping and asking again: an Editor's, in person.
  if (!person || grant.role !== 'edit') return refused('forbidden');
  if (!rate.take(`${document.id}\u0000${person}`, now)) return refused('reading_too_fast');
  if (action === 'again') {
    if (!requirement) return refused('not_required');
    const cleared = await askAgain(env, tab, now);
    console.info('[reading] asked again', { documentId: document.id, tabId: tab, cleared });
    return json(await answerOf(ctx, document, grant, tab, await requirementOf(env, tab)));
  }
  const change = parseReadingChange(await request.json().catch(() => null));
  if (typeof change === 'string') return refused(change);
  if (change.audience === null) {
    if (await clearRequirement(env, tab))
      console.info('[reading] stopped', { documentId: document.id, tabId: tab });
    return json(await answerOf(ctx, document, grant, tab, null));
  }
  const outcome = await setRequirement(
    env,
    tab,
    { audience: change.audience, people: change.people },
    person,
    now,
  );
  if ('refusal' in outcome) return refused(outcome.refusal);
  console.info('[reading] set', {
    documentId: document.id,
    tabId: tab,
    audience: change.audience,
    people: change.people.length,
  });
  return json(await answerOf(ctx, document, grant, tab, await requirementOf(env, tab)));
}
