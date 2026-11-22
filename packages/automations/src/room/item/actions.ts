// What the shared steps do when a rule runs (liveworkspace/docs/specs/018-automations/automations.md "Steps every
// app has", "Revert to Snapshot"; blueprint item-engine.md "A wake"): Take Snapshot, Revert to Snapshot, Send Email
// and Add a Tab from a Template, each through the app's kit. A step answers how it went in words for the Audit
// Trail and never throws for a refusal the kit answers.
import { cutText } from '@liveworkspace/model-core/text-cut';
import { addressWords } from '../../email-addresses';
import {
  inTabWords,
  STEP_NAME_MAX,
  emailToWords,
  snapshotWords,
  type ItemAddTab,
  type ItemEmail,
  type ItemPart,
  type ItemRevertSnapshot,
  type ItemTakeSnapshot,
} from '../../item';
import { AUTOMATION_ADDRESS_EMAILS_PER_DAY } from '../../limits';
import { AUTOMATION_COLOR, AUTOMATION_PERSON_ID, type AutomationPerson } from '../../types';
import { claimAddresses, sendToAddresses } from '../automation-addresses';
import type { ItemActionContext, ItemDeps, StepOutcome } from './kit';
import { withItemWriter } from './writer';

export const SNAPSHOT_GONE = 'The snapshot is gone';
export const EMAIL_NOT_SET_UP = "Email isn't set up here";
export const EMAIL_EMPTY = 'The email came out empty';
export const EMAIL_NOBODY = 'Nobody started this run, so there is nobody to email';
export const EMAIL_COUNT_FAILED = "Couldn't count today's emails, so none was sent";
export const NAME_EMPTY = 'The name came out empty';
// `item`: what the app calls it ("document", "Space").
export const addressCapWords = (item: string): string =>
  `This ${item} has sent its ${AUTOMATION_ADDRESS_EMAILS_PER_DAY} emails to typed-in addresses today`;

// What a shared step is run with beside the app's own context.
export interface SharedRun {
  deps: ItemDeps;
  // A step the day's limit held back: the run ends Skipped once the rest is done.
  cap(reason: string): void;
}

type SharedRunner = (
  action: ItemPart,
  ctx: ItemActionContext,
  run: SharedRun,
) => Promise<StepOutcome>;

const ok = (text: string): StepOutcome => ({ ok: true, text });
const failed = (text: string): StepOutcome => ({ ok: false, text });

/** Who a rule's change is by, for a step that writes as someone: Automation, with the rule's name beside it. */
export const automationAuthor = (ctx: Pick<ItemActionContext, 'rule'>): AutomationPerson => ({
  id: AUTOMATION_PERSON_ID,
  name: ctx.rule.name,
  color: AUTOMATION_COLOR,
});

async function takeSnapshot(
  action: ItemTakeSnapshot,
  ctx: ItemActionContext,
  run: SharedRun,
): Promise<StepOutcome> {
  const name = cutText(ctx.fill(action.name).trim(), STEP_NAME_MAX);
  if (!name) return failed(NAME_EMPTY);
  const took = await run.deps.kit.snapshots.take(name, automationAuthor(ctx));
  return took.ok
    ? ok(`Took a snapshot named “${name}”`)
    : failed(`Couldn't take the snapshot: ${took.reason}`);
}

async function revertSnapshot(
  action: ItemRevertSnapshot,
  ctx: ItemActionContext,
  run: SharedRun,
): Promise<StepOutcome> {
  const { kit } = run.deps;
  // Nothing the revert rewrites is an edit, a tab added or a tab removed.
  const reverted = await withItemWriter(
    run.deps.sql(),
    { silent: true },
    () => kit.snapshots.revert(action.snapshot, automationAuthor(ctx)),
    run.deps.fed(),
  );
  if (reverted.ok) return ok(`Reverted to “${snapshotWords(action, ctx.names)}”`);
  if (reverted.reason === 'snapshot_missing')
    return { ok: false, text: SNAPSHOT_GONE, gone: { kind: 'snapshot', id: action.snapshot } };
  return failed(`Couldn't revert: ${reverted.reason}`);
}

async function sendEmail(
  action: ItemEmail,
  ctx: ItemActionContext,
  run: SharedRun,
): Promise<StepOutcome> {
  const { kit } = run.deps;
  const mailer = kit.mail;
  if (!mailer) return failed(EMAIL_NOT_SET_UP);
  const message = {
    subject: ctx.fill(action.subject).trim(),
    body: ctx.fill(action.body).trim(),
    rule: ctx.rule.name,
  };
  if (!message.subject || !message.body) return failed(EMAIL_EMPTY);
  const { to } = action;
  if ('addresses' in to) {
    let claim: ReturnType<typeof claimAddresses>;
    try {
      // Synchronous: no await between the day's count read and its write.
      claim = claimAddresses(run.deps.sql(), to.addresses, ctx.now);
    } catch {
      return failed(EMAIL_COUNT_FAILED);
    }
    const sends = await sendToAddresses(
      {
        optOutDoor: mailer.optOutDoor,
        optOutPage: mailer.optOutPage,
        compose: (links) => links,
        send: (address, links) => mailer.sendToAddress(address, message, links),
      },
      claim.send,
    );
    if (claim.capped > 0) run.cap(addressCapWords(kit.itemWord));
    const notes = [
      ...(sends.failed.length ? [`couldn't send to ${addressWords(sends.failed)}`] : []),
      ...(claim.unsubscribed.length ? [`${claim.unsubscribed.length} unsubscribed`] : []),
      ...(claim.capped ? [`${claim.capped} left out by today's limit`] : []),
    ];
    const sent = sends.sent.length ? `Emailed ${addressWords(sends.sent)}` : 'Emailed nobody';
    const text = notes.length ? `${sent} (${notes.join(', ')})` : sent;
    // Every address failing fails the step; some sent, it is done with the rest named on its line.
    return sends.failed.length > 0 && sends.sent.length === 0 ? failed(text) : ok(text);
  }
  const words = emailToWords(to, ctx.names);
  if ('person' in to && !ctx.outline.people.some((p) => p.id === to.person))
    return { ok: false, text: 'The person is gone', gone: { kind: 'person', id: to.person } };
  const personId =
    'owner' in to ? ctx.outline.ownerId : 'trigger' in to ? ctx.event.by?.id : to.person;
  if (!personId) return failed(EMAIL_NOBODY);
  const sent = await mailer.sendToPerson(personId, message);
  return sent ? ok(`Emailed ${words}`) : failed(`Couldn't email ${words}: no address to send to`);
}

async function addTab(
  action: ItemAddTab,
  ctx: ItemActionContext,
  run: SharedRun,
): Promise<StepOutcome> {
  const { kit } = run.deps;
  if (!kit.addTab)
    return failed(inTabWords(`This ${kit.itemWord} can't add a tab from a template`, kit.itemWord));
  const name = cutText(ctx.fill(action.name).trim(), STEP_NAME_MAX);
  if (!name) return failed(NAME_EMPTY);
  const added = await kit.addTab(action.template, name);
  return 'failed' in added
    ? failed(added.failed)
    : ok(`${inTabWords('Added a tab named', kit.itemWord)} “${added.name}”`);
}

/** The shared steps' runners, by kind. */
export const SHARED_RUNNERS: ReadonlyMap<string, SharedRunner> = new Map<string, SharedRunner>([
  ['take_snapshot', (a, ctx, run) => takeSnapshot(a as ItemTakeSnapshot & ItemPart, ctx, run)],
  [
    'revert_snapshot',
    (a, ctx, run) => revertSnapshot(a as ItemRevertSnapshot & ItemPart, ctx, run),
  ],
  ['email', (a, ctx, run) => sendEmail(a as unknown as ItemEmail, ctx, run)],
  ['add_tab', (a, ctx, run) => addTab(a as ItemAddTab & ItemPart, ctx, run)],
]);
