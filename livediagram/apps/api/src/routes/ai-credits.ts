// A photo read's AI credits (docs/specs/021-event-storming/note-reader.md "AI credits (Pro)"): who pays for them,
// what the read costs (one credit for every 24 of its notes, `photoReadCredits`), the spend before the model is
// called, and the read pass that lets a read's later requests through without a second spend. With Pro off none of
// it runs: nothing is asked of the index or the subscription service.
import {
  levelAtLeast,
  PHOTO_MAX_NOTES,
  type NoteCrop,
  type ReadCredits,
  type ReadCreditsRefusal,
  type ReadNotesRequest,
} from '@livediagram/api-schema';
import {
  itemPayer,
  personScope,
  PHOTO_NOTES_PER_CREDIT,
  photoReadCredits,
  refusedByService,
  type OwnerScope,
  subscriptionClientOf,
} from '@liveworkspace/subscription';
import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';
import { documentRoom } from '../document-client';
import { utcDay } from '../document-room/owner-reads';
import { json } from '../responses';
import type { RouteContext } from './context';
import { resolveDocumentGrant } from './document-grant';

/** How long a read pass holds: a wall's batches, and the notes read again in its review. */
export const READ_PASS_MS = 10 * 60 * 1000;
/**
 * The most photo reads a day that people who are NOT a diagram's owner (or a member of its owning team) may charge
 * to that owner, per diagram (note-reader.md "A collaborator's reads"). One Editor link must not be a way to spend
 * the owner's month: twenty photos a day is a long workshop's worth, as liveplanner's 20 AI drafts a day per plan
 * is, and at most 600 of the owner's credits a month from one diagram. Past it the reader reads on the device.
 * Safe range 5..100.
 */
export const OWNER_READS_BY_OTHERS_PER_DAY = 20;
// A read's id, as the editor mints it.
const READ_ID = /^[A-Za-z0-9_-]{8,64}$/;
// The longest diagram id a read may name (the documents route's own bound).
const DOCUMENT_ID_MAX = 200;

const encoder = new TextEncoder();

async function mac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  let bin = '';
  for (const byte of sig) bin += String.fromCharCode(byte);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

// The key a read pass is signed with: never the app's bearer key itself (a pass is held by a browser, and a signature
// made with the key that also opens the subscription service is one more thing to go wrong), but a key derived from
// it for this one purpose, HMAC(SUBSCRIPTION_KEY, a fixed label). One derivation an isolate per secret.
const PASS_KEY_LABEL = 'livediagram:read-pass:v1';
const passKeys = new Map<string, Promise<string>>();
function passKeyOf(secret: string): Promise<string> {
  let key = passKeys.get(secret);
  if (!key) passKeys.set(secret, (key = mac(secret, PASS_KEY_LABEL)));
  return key;
}

/** The pass a paid read is given: `<lapses>.<signature over the payer, the read, the notes paid for and when it
 *  lapses>`, signed with the key derived from `secret` (the app's subscription key). */
export async function sealReadPass(
  secret: string,
  payer: OwnerScope,
  read: string,
  notes: number,
  lapses: number,
): Promise<string> {
  return `${lapses}.${await mac(await passKeyOf(secret), `read|${payer}|${read}|${notes}|${lapses}`)}`;
}

/** Whether `pass` was sealed for this payer, this read and this many notes, and has not lapsed. */
export async function readPassHolds(
  secret: string,
  payer: OwnerScope,
  read: string,
  notes: number,
  pass: unknown,
  now: number,
): Promise<boolean> {
  if (typeof pass !== 'string' || pass.length > 128) return false;
  const lapses = Number(pass.slice(0, pass.indexOf('.')));
  if (!Number.isSafeInteger(lapses) || lapses <= now) return false;
  return timingSafeEqual(await sealReadPass(secret, payer, read, notes, lapses), pass);
}

/** A charged read's note count, as the request declares it: a whole number from 1 to the most one photo may yield,
 *  or null for anything else. */
export function readNotesOf(notes: unknown): number | null {
  return typeof notes === 'number' &&
    Number.isInteger(notes) &&
    notes >= 1 &&
    notes <= PHOTO_MAX_NOTES
    ? notes
    : null;
}

/**
 * Whether every crop is a note the read paid for (note-reader.md "A request is bounded by what was paid"): one of
 * the photo's found notes, numbered from 0, or a box drawn in the review, numbered from -1 down, within the notes
 * the credits paid for (24 a credit).
 */
export function readCovers(notes: number, crops: readonly Pick<NoteCrop, 'id'>[]): boolean {
  const drawn = photoReadCredits(notes) * PHOTO_NOTES_PER_CREDIT;
  return crops.every((crop) => crop.id < notes && crop.id >= -drawn);
}

/**
 * Who pays, and whether the caller may know the payer's count (the payer themself, or the paying team's member).
 * `documentId`: the diagram whose owner pays, when the payer is not the reader: its day's count of such reads.
 */
export type ReadPayer = { scope: OwnerScope; theirs: boolean; documentId: string | null };

/**
 * Who pays for a read (note-reader.md "Who pays"). Nobody for a reader without an account, whatever they read into:
 * a guest's reads are bounded by the gate alone, as before Pro, and never spend anyone's credit. For someone signed
 * in: the owner of the diagram it names, where they hold an Editor's grant on it (the team for a team's diagram), by
 * the one rule every app follows (`itemPayer`); nobody for a guest's diagram, which is never sent to the
 * subscription service; else the reader themself. Never anything the request claims: the diagram's owner is the
 * index's word.
 */
export async function readPayer(ctx: RouteContext, documentId: unknown): Promise<ReadPayer | null> {
  const caller = ctx.verifiedUserId ?? ctx.accountUserId;
  if (!caller) return null;
  if (typeof documentId === 'string' && documentId !== '' && documentId.length <= DOCUMENT_ID_MAX) {
    const grant = await resolveDocumentGrant(ctx, documentId).catch(() => null);
    if (
      grant &&
      !(grant instanceof Response) &&
      !grant.trashed &&
      levelAtLeast(grant.level, 'edit')
    ) {
      const payer = itemPayer(grant);
      if (payer.kind === 'guest') return null;
      if (payer.kind === 'owner') {
        const team = grant.team;
        const theirs = team ? (ctx.teams ?? []).some((t) => t.id === team) : grant.owner === caller;
        return { scope: payer.scope, theirs, documentId: theirs ? null : documentId };
      }
    }
  }
  return { scope: personScope(caller), theirs: true, documentId: null };
}

export type ReadCharge = { refused: Response } | { credits: ReadCredits | null };

// One more read charged to the diagram's owner by someone else today, or false at the day's cap. The diagram's own
// room keeps the count. A room that cannot answer refuses: this guards somebody else's credits, and the reader still
// reads on the device.
async function ownerReadTaken(
  ctx: RouteContext,
  documentId: string,
  now: number,
): Promise<boolean> {
  try {
    return await documentRoom(ctx.env, documentId).takeOwnerRead(
      utcDay(now),
      OWNER_READS_BY_OTHERS_PER_DAY,
    );
  } catch (error) {
    console.warn('[ai/read-notes] owner reads uncounted', String(error));
    return false;
  }
}

// A read taken against the day's cap that then spent nothing gives its slot back, so the owner's used month never
// shortens a collaborator's day. Best effort: a room that cannot answer keeps the slot, which only errs safe.
async function ownerReadGivenBack(
  ctx: RouteContext,
  documentId: string,
  now: number,
): Promise<void> {
  try {
    await documentRoom(ctx.env, documentId).giveBackOwnerRead(utcDay(now));
  } catch (error) {
    console.warn('[ai/read-notes] owner read not given back', String(error));
  }
}

/**
 * Spend the read's AI credits before the model is called (one for every 24 of the notes it declares), unless this
 * request carries the pass of a read already paid for. `credits` is null where nothing is counted: Pro off, or nobody to charge (a guest keeps the day's cap
 * alone, and so does anyone reading into a guest's diagram).
 */
export async function chargeRead(
  ctx: RouteContext,
  body: ReadNotesRequest,
  now: number = Date.now(),
): Promise<ReadCharge> {
  const client = subscriptionClientOf(ctx.env, 'livediagram.app');
  if (!client.enabled) return { credits: null };
  const payer = await readPayer(ctx, body.documentId);
  if (!payer) return { credits: null };
  const owner = payer.scope;
  const secret = ctx.env.SUBSCRIPTION_KEY;
  const read = typeof body.read === 'string' && READ_ID.test(body.read) ? body.read : null;
  // A charged read names itself, so its pass can cover its later requests: one that does not would spend a credit
  // on every request, so it is refused instead.
  if (!read) {
    console.warn('[ai/read-notes] read id missing');
    return { refused: json({ error: 'read_required' }, { status: 400 }) };
  }
  // A charged read says how many notes it has, and that is what it costs (note-reader.md "What a read costs").
  const notes = readNotesOf(body.notes);
  if (notes === null) {
    console.warn('[ai/read-notes] note count missing');
    return { refused: json({ error: 'notes_required' }, { status: 400 }) };
  }
  // Every crop is one of the notes paid for: a pass for ten notes is never a pass for note fifty.
  if (!readCovers(notes, body.crops)) {
    console.warn('[ai/read-notes] a crop past the notes paid for');
    return { refused: json({ error: 'notes_exceeded' }, { status: 400 }) };
  }
  const cost = photoReadCredits(notes);
  if (secret && (await readPassHolds(secret, owner, read, notes, body.pass, now))) {
    return { credits: { owner, pass: body.pass, cost } };
  }
  // Someone else's credit: the diagram takes only so many such reads a day. Past it the answer is the day's cap's
  // own, so the editor reads the photo on the device and says AI is resting for today.
  if (payer.documentId !== null && !(await ownerReadTaken(ctx, payer.documentId, now))) {
    console.warn('[ai/read-notes] owner reads capped');
    return { refused: json({ error: 'ai_quota' }, { status: 429 }) };
  }
  const spent = await client.spend(owner, 'aiCredits', cost);
  if (payer.documentId !== null && (refusedByService(spent) || !spent.ok)) {
    await ownerReadGivenBack(ctx, payer.documentId, now);
  }
  if (refusedByService(spent)) {
    // The service refused this Worker's request (its key, never the payer's month): the read is not made uncounted,
    // and the answer is the reader being unavailable, never credits used with an offer to upgrade.
    console.error(
      '[ai/read-notes] credits not checked: the subscription service refused the request',
    );
    return { refused: json({ error: 'ai_not_configured' }, { status: 503 }) };
  }
  if (!spent.ok) {
    console.warn('[ai/read-notes] credits used');
    // The numbers are the payer's own: for them and the paying team alone. Anyone else charged to them is told
    // whose month it is (they are signed in, and ask which action they may take) and that it is used.
    const refusal: ReadCreditsRefusal = {
      error: 'ai_credits_used',
      limit: 'aiCreditsPerMonth',
      ...(payer.theirs ? { used: spent.used, max: spent.limit ?? 0 } : {}),
      owner,
    };
    return { refused: json(refusal, { status: 429 }) };
  }
  const pass = secret ? await sealReadPass(secret, owner, read, notes, now + READ_PASS_MS) : null;
  // A spend that reads nothing used is the client's answer for a service it could not reach: the read goes
  // ahead, and no count is claimed.
  const counted = payer.theirs && !spent.unmetered && spent.used > 0;
  return {
    credits: {
      owner,
      ...(pass ? { pass } : {}),
      cost,
      ...(counted && spent.limit !== null ? { used: spent.used, max: spent.limit } : {}),
    },
  };
}
