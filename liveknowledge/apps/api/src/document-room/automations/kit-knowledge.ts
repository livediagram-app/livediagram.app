// liveknowledge's knowledge steps as a rule runs them (docs/specs/013-workspace/automations.md "Steps of its own";
// blueprint automations.md "The kit"): Set the Page Owner, Clear Verification, Email the Page Owner and Always in
// Context, each through the same save Page Health makes (knowledge/page-fields-save.ts), by the rule: the owner
// checked as Page Health checks it, Always in Context held to its budget. And `page.owner`, the room's own value.
import {
  CLEAR_VERIFICATION_STEP,
  CONTEXT_STEP,
  EMAIL_OWNER_STEP,
  NO_OWNER_WORD,
  PAGE_OWNER_VALUE,
  SET_OWNER_STEP,
  type ClearVerificationStep,
  type ContextStep,
  type EmailOwnerStep,
  type SetOwnerStep,
} from '@liveknowledge/document/automations';
import {
  CONTEXT_BUDGET_TOKENS,
  fitsContextBudget,
  parseKnowledgeFields,
  tokensOfChars,
  type KnowledgeFields,
} from '@liveknowledge/knowledge';
import { AUTOMATION_PERSON_ID } from '@liveworkspace/automations';
import { RUN_TAB, type ItemEvent } from '@liveworkspace/automations/item';
import {
  type ItemActionContext,
  type ItemActionRunner,
  type StepOutcome,
} from '@liveworkspace/automations/room';
import { contextPages } from '../../knowledge/knowledge-reads';
import { personCanOpen, savePageFields } from '../../knowledge/page-fields-save';
import { readPageKnowledge } from '../../knowledge/page-knowledge';
import { getParticipant } from '../../person/profiles';
import type { DocumentEnv } from '../../types';
import { kitMail } from './kit-mail';
import { ruleWho } from './version-events';

export const NO_RUN_PAGE = 'This run has no page';
export const PAGE_GONE = 'The page is gone';
export const PAGE_BUSY = 'The page kept changing';
export const NO_STARTER = 'Nobody started this rule who can own a page';
export const NO_OWNER = 'This page has no owner';
export const NOT_VERIFIED = 'Was not verified';

const failed = (text: string): StepOutcome => ({ ok: false, text });
const pageGone = (id: string): StepOutcome => ({
  ok: false,
  text: PAGE_GONE,
  gone: { kind: 'tab', id },
});

const pageOf = (tab: string, ctx: ItemActionContext): string | null =>
  tab === RUN_TAB ? (ctx.tab?.id ?? null) : tab;
const pageName = (ctx: ItemActionContext, id: string): string =>
  ctx.outline.tabs.find((t) => t.id === id)?.name ?? 'the page';

type Refusal = { text: string };

// One fields save by the rule, said as a step's outcome.
async function save(
  env: DocumentEnv,
  documentId: string,
  tab: string,
  ctx: ItemActionContext,
  change: (fields: KnowledgeFields, chars: number) => Promise<KnowledgeFields | Refusal>,
  done: string,
): Promise<StepOutcome> {
  const saved = await savePageFields<Refusal>(
    env,
    documentId,
    tab,
    async (page) => {
      const next = await change(page.fields, page.chars);
      return 'text' in next ? { refused: next } : next;
    },
    { who: async () => ruleWho(ctx) },
  );
  if (saved.kind === 'gone') return pageGone(tab);
  if (saved.kind === 'busy') return failed(PAGE_BUSY);
  if (saved.kind === 'refused') return failed(saved.refusal.text);
  return { ok: true, text: done };
}

async function setOwner(
  env: DocumentEnv,
  documentId: string,
  step: SetOwnerStep,
  ctx: ItemActionContext,
): Promise<StepOutcome> {
  const tab = pageOf(step.tab, ctx);
  if (!tab) return failed(NO_RUN_PAGE);
  if (!ctx.outline.tabs.some((t) => t.id === tab)) return pageGone(tab);
  const person =
    'trigger' in step.to
      ? ctx.event.role === 'automation' || ctx.event.by?.id === AUTOMATION_PERSON_ID
        ? ''
        : (ctx.event.by?.id ?? '')
      : step.to.person;
  if (!person) return failed(NO_STARTER);
  const name =
    ctx.outline.people.find((p) => p.id === person)?.name ??
    (await getParticipant(env, person))?.name ??
    'Someone';
  const may = await personCanOpen(
    env,
    { id: documentId, ownerId: ctx.outline.ownerId },
    person,
  ).catch(() => false);
  if (!may)
    return 'person' in step.to
      ? {
          ok: false,
          text: `${name} can't open this knowledgebase`,
          gone: { kind: 'person', id: person },
        }
      : failed(`${name} can't open this knowledgebase`);
  return save(
    env,
    documentId,
    tab,
    ctx,
    async (fields) => ({ ...fields, owner: person }),
    `Made ${name} the owner of ${pageName(ctx, tab)}`,
  );
}

function clearVerification(
  env: DocumentEnv,
  documentId: string,
  step: ClearVerificationStep,
  ctx: ItemActionContext,
): Promise<StepOutcome> | StepOutcome {
  const tab = pageOf(step.tab, ctx);
  if (!tab) return failed(NO_RUN_PAGE);
  return save(
    env,
    documentId,
    tab,
    ctx,
    async (fields) => {
      if (fields.verifiedAt === undefined) return { text: NOT_VERIFIED };
      const { verifiedAt: _at, verifiedBy: _by, ...rest } = fields;
      return rest;
    },
    `Cleared the verification of ${pageName(ctx, tab)}`,
  );
}

function setContext(
  env: DocumentEnv,
  documentId: string,
  step: ContextStep,
  ctx: ItemActionContext,
): Promise<StepOutcome> | StepOutcome {
  const tab = pageOf(step.tab, ctx);
  if (!tab) return failed(NO_RUN_PAGE);
  const name = pageName(ctx, tab);
  return save(
    env,
    documentId,
    tab,
    ctx,
    async (fields, chars) => {
      if (!step.on) {
        const { context: _context, ...rest } = fields;
        return rest;
      }
      if (fields.context) return fields;
      // Always in Context holds what fits the budget every agent is handed (ai-knowledge.md).
      const used = (await contextPages(env, documentId)).reduce((sum, p) => sum + p.tokens, 0);
      const tokens = tokensOfChars(chars);
      if (!fitsContextBudget(tokens, used))
        return {
          text: `This page is ${tokens.toLocaleString('en')} tokens and ${used.toLocaleString('en')} of ${CONTEXT_BUDGET_TOKENS.toLocaleString('en')} are in use`,
        };
      return { ...fields, context: true };
    },
    step.on ? `Added ${name} to Always in Context` : `Removed ${name} from Always in Context`,
  );
}

async function emailOwner(
  env: DocumentEnv,
  documentId: string,
  step: EmailOwnerStep,
  ctx: ItemActionContext,
): Promise<StepOutcome> {
  const tab = ctx.tab?.id;
  if (!tab) return failed(NO_RUN_PAGE);
  const mail = kitMail(env, documentId);
  if (!mail) return failed("Email isn't set up here");
  const page = await readPageKnowledge(env, documentId, tab);
  if (!page) return pageGone(tab);
  const owner = page.fields.owner;
  if (!owner) return failed(NO_OWNER);
  const sent = await mail.sendToPerson(owner, {
    subject: ctx.fill(step.subject),
    body: ctx.fill(step.body),
    rule: ctx.rule.name,
  });
  const name = ctx.outline.people.find((p) => p.id === owner)?.name ?? 'the page’s owner';
  return sent ? { ok: true, text: `Emailed ${name}` } : failed(`${name} has no address to email`);
}

/** The knowledge steps' runners, by kind. */
export function knowledgeRunners(
  env: DocumentEnv,
  documentId: string,
): Readonly<Record<string, ItemActionRunner>> {
  return {
    [SET_OWNER_STEP]: (action, ctx) =>
      setOwner(env, documentId, action as unknown as SetOwnerStep, ctx),
    [CLEAR_VERIFICATION_STEP]: async (action, ctx) =>
      clearVerification(env, documentId, action as unknown as ClearVerificationStep, ctx),
    [CONTEXT_STEP]: async (action, ctx) =>
      setContext(env, documentId, action as unknown as ContextStep, ctx),
    [EMAIL_OWNER_STEP]: (action, ctx) =>
      emailOwner(env, documentId, action as unknown as EmailOwnerStep, ctx),
  };
}

/** The room's own values for an event: the run's page's owner, by name. One read of that page, none without one. */
export async function knowledgeValues(
  env: DocumentEnv,
  documentId: string,
  event: ItemEvent,
): Promise<Readonly<Record<string, string>>> {
  if (!event.tab) return {};
  const page = await readPageKnowledge(env, documentId, event.tab);
  const owner = page ? parseKnowledgeFields(page.fields).owner : undefined;
  if (!owner) return { [PAGE_OWNER_VALUE]: NO_OWNER_WORD };
  const name = (await getParticipant(env, owner))?.name;
  return { [PAGE_OWNER_VALUE]: name || 'Someone' };
}
