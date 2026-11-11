// A planned run applied (docs/specs/026-plan/automations.md "Actions", "On cards"; blueprint automations.md
// "Files", "The run"). The triggering card's changes land as ONE write through the item store's rev-guarded update,
// with the checks a card write passes (a column its type leaves out, a required field emptied, a Calculated field
// set, the card's size), by Automation with the rule's name and history tag 'automation'. Then the card it makes (as
// a Repeat makes its copies), the threads it starts (by Automation, through the thread store) and its emails
// (account people alone, their opt-out honoured, in the background). Each write is relayed to the room and carries
// the rule and chain, so the events it causes know where they came from.
import {
  ITEMS_MAX,
  ITEM_WRITE_RETRIES,
  AUTOMATION_COLOR,
  AUTOMATION_PERSON_ID,
  applyMove,
  applyPatch,
  automationPerson,
  calculatedWritten,
  createRefusal,
  fieldsWithinBounds,
  itemPlacer,
  itemStatus,
  itemTitle,
  makeItem,
  newItemId,
  requiredClearedBy,
  statusExcluded,
  typeIn,
  withDefaultStatuses,
  type AutomationRule,
  type Item,
  type ItemPatch,
  type PlannedCard,
  type PlannedEmail,
} from '@liveplanner/items';
import { CARD_THREADS_MAX, newThreadId, startThread, type Comment } from '@liveplanner/project';
import { isAccountId } from '@liveworkspace/auth-client';
import {
  getItemStoreHead,
  insertItems,
  listItems,
  readItem,
  updateItemAtRev,
} from '../../db/items';
import { threadCountOfItem } from '../../db/card-threads';
import { appendItemHistory } from '../../db/item-history';
import { notifyRecipients } from '../../person/notify';
import { emailEnabled, sendEmail } from '../../email/client';
import { automationEmail } from '../../email/templates';
import type { PlanEnv } from '../../types';
import { insertThread } from '../card-thread-store';
import type { AutomationPlan } from './automation-plan';
import type { HistorySource } from './automation-queue';

export interface WriteDeps {
  env: PlanEnv;
  planId: string;
  // Hands landed cards to the room.
  relay: (items: Item[], rev: number) => void;
  // Work that may outlive the run (a thread's relay, an email).
  defer: (p: Promise<unknown>) => void;
}

export type WriteOutcome = { ok: true } | { ok: false; reason: string };

// The rule's write as a card write would be refused, in words.
function refusalOf(plan: AutomationPlan, next: Item, before: Item): string | null {
  const types = plan.types;
  if (statusExcluded(types, next, before, false)) return `The card's type leaves out that column`;
  const calculated = calculatedWritten(types, next, before);
  if (calculated) return `${calculated} is worked out, never set`;
  const cleared = requiredClearedBy(types, next, before, false);
  if (cleared) return `${cleared} is required`;
  return fieldsWithinBounds(next.fields) ? 'The card would be too big' : null;
}

// The one write to the triggering card: the patch, as a move when it changes the column (so the card goes to the
// end of its new column, as a drop would put it).
// `tag`: the history line's, 'automation_ai' for an AI step's write.
export async function patchCard(
  deps: WriteDeps,
  plan: AutomationPlan,
  rule: AutomationRule,
  cardId: string,
  patch: ItemPatch,
  source: HistorySource,
  tag: 'automation' | 'automation_ai' = 'automation',
): Promise<WriteOutcome> {
  const by = automationPerson(rule.name);
  for (let attempt = 1; attempt <= ITEM_WRITE_RETRIES; attempt += 1) {
    const now = Date.now();
    const before = await readItem(deps.env, deps.planId, cardId);
    if (!before) return { ok: false, reason: 'The card is gone' };
    const status = patch.set?.['status'];
    const { status: _status, ...set } = patch.set ?? {};
    const next =
      typeof status === 'string' && status !== itemStatus(before)
        ? applyMove(
            before,
            { status, set, ...(patch.clear ? { clear: patch.clear } : {}) },
            await listItems(deps.env, deps.planId),
            { now, by },
          )
        : applyPatch(before, patch, { now, by });
    const refused = refusalOf(plan, next, before);
    if (refused) return { ok: false, reason: refused };
    const rev = await updateItemAtRev(deps.env, deps.planId, next, before.rev);
    if (rev === null) continue;
    deps.relay([next], rev);
    await appendItemHistory(deps.env, deps.planId, [{ before, after: next }], tag, source);
    return { ok: true };
  }
  return { ok: false, reason: 'The card kept changing' };
}

// The card a Create Card makes, in its column or its type's Default State, by Automation.
async function createCard(
  deps: WriteDeps,
  plan: AutomationPlan,
  rule: AutomationRule,
  planned: PlannedCard,
  source: HistorySource,
): Promise<WriteOutcome> {
  const [create] = withDefaultStatuses(
    [
      {
        type: planned.type,
        fields: planned.fields,
        ...(planned.status ? { place: { status: planned.status } } : {}),
      },
    ],
    plan.types,
  );
  const missing = createRefusal(plan.types, create!);
  if (missing) {
    const type = typeIn(plan.types, planned.type);
    const label = type.custom?.find((f) => f.id === missing.field)?.label ?? missing.field;
    return { ok: false, reason: `${type.label} cards need ${label}` };
  }
  for (let attempt = 1; attempt <= ITEM_WRITE_RETRIES; attempt += 1) {
    const head = await getItemStoreHead(deps.env, deps.planId);
    if (head.count >= ITEMS_MAX)
      return { ok: false, reason: 'The plan holds as many cards as it may' };
    const items = await listItems(deps.env, deps.planId);
    const keys = new Set(items.map((i) => i.key));
    let key = head.nextKey;
    while (keys.has(key)) key += 1;
    const made = makeItem(create!, {
      id: newItemId(),
      key,
      now: Date.now(),
      by: automationPerson(rule.name),
      items: itemPlacer(items),
    });
    try {
      const rev = await insertItems(deps.env, deps.planId, [made]);
      deps.relay([made], rev);
      await appendItemHistory(
        deps.env,
        deps.planId,
        [{ before: null, after: made }],
        'automation',
        source,
      );
      return { ok: true };
    } catch (error) {
      // A key taken since the store was read: read it again.
      if (attempt >= ITEM_WRITE_RETRIES) throw error;
    }
  }
  return { ok: false, reason: 'The plan kept changing' };
}

// A new thread on the card, its comment by Automation with the rule's name (`ai`: an AI step's, marked Generated by
// AI). It starts no Comment Added rule.
export async function addComment(
  deps: WriteDeps,
  rule: AutomationRule,
  card: Item,
  text: string,
  mark: { ai?: true } = {},
): Promise<WriteOutcome> {
  if ((await threadCountOfItem(deps.env, deps.planId, card.id)) >= CARD_THREADS_MAX)
    return { ok: false, reason: 'The card holds as many threads as it may' };
  const now = Date.now();
  const comment: Comment = {
    id: crypto.randomUUID(),
    text,
    createdAt: now,
    authorName: 'Automation',
    authorColor: AUTOMATION_COLOR,
    authorId: AUTOMATION_PERSON_ID,
    automation: { ruleId: rule.id, rule: rule.name },
    ...(mark.ai ? { ai: true as const } : {}),
  };
  const thread = startThread({
    id: newThreadId(),
    home: deps.planId,
    card: { projectId: deps.planId, itemId: card.id, key: card.key },
    comment,
    now,
  });
  await insertThread(deps.env, thread, deps.defer);
  return { ok: true };
}

// An email to a person of the plan with an account, unless they turned these off. Never fails the run.
async function sendOne(
  deps: WriteDeps,
  plan: AutomationPlan,
  rule: AutomationRule,
  card: Item,
  email: PlannedEmail,
  url: string,
): Promise<void> {
  const accountId = email.to ? plan.accounts.get(email.to.id) : undefined;
  if (!accountId || !isAccountId(accountId) || !emailEnabled(deps.env)) return;
  const to = (await notifyRecipients(deps.env, [accountId], 'notifyActionAssigned')).get(accountId);
  if (!to) return;
  await sendEmail(deps.env, {
    to,
    ...automationEmail(deps.env, {
      subject: email.subject || itemTitle(card),
      body: email.body,
      rule: rule.name,
      planName: plan.name,
      cardUrl: url,
    }),
  });
}

// The planned run's writes, in order: the card's one patch, the card it makes, its threads, then its emails. The
// first that is refused stops the rest; what landed before it stays.
export async function applyPlannedRun(
  deps: WriteDeps,
  plan: AutomationPlan,
  rule: AutomationRule,
  card: Item,
  planned: { patch: ItemPatch; comments: string[]; created: PlannedCard[]; emails: PlannedEmail[] },
  source: HistorySource,
  url: string,
): Promise<WriteOutcome> {
  if (planned.patch.set || planned.patch.clear) {
    const out = await patchCard(deps, plan, rule, card.id, planned.patch, source);
    if (!out.ok) return out;
  }
  for (const made of planned.created) {
    const out = await createCard(deps, plan, rule, made, source);
    if (!out.ok) return out;
  }
  for (const text of planned.comments) {
    const out = await addComment(deps, rule, card, text);
    if (!out.ok) return out;
  }
  for (const email of planned.emails)
    deps.defer(
      sendOne(deps, plan, rule, card, email, url).catch((error: unknown) =>
        console.warn('[automations] email.failed', { error: String(error) }),
      ),
    );
  return { ok: true };
}
