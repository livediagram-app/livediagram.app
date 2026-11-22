// What the editor holds of each page's knowledge beyond the tab itself (docs/specs/030-knowledgebase/verification.md):
// its Page Health (the fields as the server reads them, Changed since verified, the week's reads), read once when the
// page opens and kept for the session, and the fields a Verify or a Page Health change has just set, shown at once
// and rolled back if the server refuses. Outside React: a reader subscribes to one page's entry.
import {
  applyApproval,
  trustState,
  verified,
  type ApprovalAction,
  type KnowledgeFields,
  type ReviewEvery,
  guestVerifierName,
  isGuestVerifier,
} from '@liveknowledge/knowledge';
import type {
  PageHealthResponse,
  PageKnowledge,
  PageKnowledgePatch,
} from '@liveknowledge/api-schema';
import { knowledgeSettingsStore } from '@/lib/knowledge-settings/knowledge-settings-store';
import {
  apiPageHealth,
  apiSetPageKnowledge,
  apiVerifyPage,
  type KnowledgeCaller,
} from '@/lib/api/knowledge';
import { apiPageApproval } from '@/lib/api/page-feedback';

export type PageKnowledgeApi = {
  health: typeof apiPageHealth;
  verify: typeof apiVerifyPage;
  set: typeof apiSetPageKnowledge;
  /** Defaults to the route's own call. */
  approval?: typeof apiPageApproval;
};

/** A page as the store reads it: its id and the fields its tab carries. */
export type KnowledgePage = { id: string; knowledge?: unknown };

type Override = { fields: KnowledgeFields; base: unknown };

const FIELD_KEYS = ['owner', 'verifiedAt', 'verifiedBy', 'context', 'approval'] as const;

const fieldsOfKnowledge = (knowledge: PageKnowledge): KnowledgeFields => {
  const fields: KnowledgeFields = {};
  for (const key of FIELD_KEYS) {
    if (knowledge[key] !== undefined) (fields as Record<string, unknown>)[key] = knowledge[key];
  }
  return fields;
};

// The fields with the state the knowledgebase's Review Period and the clock give them, in the route's shape; what
// only the server knows is kept.
function withFields(
  was: PageKnowledge,
  fields: KnowledgeFields,
  every: ReviewEvery,
  now: number,
): PageKnowledge {
  const trust = trustState(fields, every, now);
  return {
    tab: was.tab,
    ...fields,
    state: trust.state,
    ...('reviewAt' in trust && trust.reviewAt !== undefined ? { reviewAt: trust.reviewAt } : {}),
    changedSinceVerified: was.changedSinceVerified,
    tokens: was.tokens,
  };
}

function patched(fields: KnowledgeFields, patch: PageKnowledgePatch): KnowledgeFields {
  const next: KnowledgeFields = { ...fields };
  if (patch.owner === null) delete next.owner;
  else if (patch.owner !== undefined) next.owner = patch.owner;
  if (patch.context === true) next.context = true;
  else if (patch.context === false) delete next.context;
  return next;
}

export function createPageKnowledgeStore(
  api: PageKnowledgeApi = {
    health: apiPageHealth,
    verify: apiVerifyPage,
    set: apiSetPageKnowledge,
    approval: apiPageApproval,
  },
  // The knowledgebase's Review Period, read when a change is shown before the server answers.
  reviewEveryOf: (documentId: string) => ReviewEvery = knowledgeSettingsStore.reviewEveryOf,
) {
  const health = new Map<string, PageHealthResponse>();
  const loading = new Map<string, Promise<void>>();
  const overrides = new Map<string, Override>();
  const listeners = new Set<() => void>();
  let version = 0;
  const changed = () => {
    version++;
    for (const listener of listeners) listener();
  };
  const keyOf = (documentId: string, tab: string) => `${documentId}\u0000${tab}`;

  /** The page's fields: what was just set here, until the tab itself says something newer (the room's patch). */
  // `_at`: the store's version the caller read, so a memoising compiler asks again when it moves.
  const fieldsOf = (page: KnowledgePage, _at?: number): unknown => {
    const override = overrides.get(page.id);
    return override && override.base === page.knowledge ? override.fields : page.knowledge;
  };

  // One optimistic write: shown at once, the server's answer kept, or everything put back on a refusal.
  async function write(
    documentId: string,
    page: KnowledgePage,
    next: KnowledgeFields,
    change: (was: PageKnowledge) => PageKnowledge,
    send: () => Promise<PageKnowledge>,
  ): Promise<PageKnowledge> {
    const key = keyOf(documentId, page.id);
    const wasHealth = health.get(key);
    const wasOverride = overrides.get(page.id);
    overrides.set(page.id, { fields: next, base: page.knowledge });
    if (wasHealth) health.set(key, { ...wasHealth, knowledge: change(wasHealth.knowledge) });
    changed();
    try {
      const knowledge = await send();
      overrides.set(page.id, { fields: fieldsOfKnowledge(knowledge), base: page.knowledge });
      // What only Page Health's read says (the reads, who created and updated the page) is kept.
      const held = health.get(key) ?? wasHealth;
      health.set(key, { ...held, knowledge, reads: held?.reads ?? { people: 0, agents: 0 } });
      changed();
      return knowledge;
    } catch (err) {
      if (wasOverride) overrides.set(page.id, wasOverride);
      else overrides.delete(page.id);
      if (wasHealth) health.set(key, wasHealth);
      else health.delete(key);
      changed();
      throw err;
    }
  }

  return {
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Moves with every change: a reader that derives from several pages (the tree's marks) keys on it. */
    version: () => version,
    fieldsOf,
    /** `_at`: the store's version the caller read (see fieldsOf). */
    healthOf: (documentId: string, tab: string, _at?: number) => health.get(keyOf(documentId, tab)),
    /** Read a page's health: once per page for the session unless `fresh`, or on every open (`opened`, which also
     *  counts the person's read); concurrent asks share one request. A failure leaves what was held (the fields still
     *  show from the tab, the last counts stay until the new ones land). */
    load(
      who: KnowledgeCaller,
      documentId: string,
      tab: string,
      fresh = false,
      opened = false,
    ): Promise<void> {
      const key = keyOf(documentId, tab);
      if (!fresh && !opened && health.has(key)) return Promise.resolve();
      const running = loading.get(key);
      if (running) return running;
      const request = api
        .health(who, documentId, tab, undefined, opened)
        .then(
          (answer) => {
            health.set(key, answer);
            changed();
          },
          () => {},
        )
        .finally(() => loading.delete(key));
      loading.set(key, request);
      return request;
    },
    /** Verify: verified now by `person`, who owns a page with no owner. Rejects, rolled back, on a refusal. */
    verify(
      who: KnowledgeCaller,
      documentId: string,
      page: KnowledgePage,
      person: string,
      now: number,
    ): Promise<PageKnowledge> {
      const next = verified(fieldsOfPage(page), person, now);
      return write(
        documentId,
        page,
        next,
        (was) => ({
          ...withFields(was, next, reviewEveryOf(documentId), now),
          changedSinceVerified: false,
        }),
        () =>
          isGuestVerifier(person)
            ? api.verify(who, documentId, page.id, guestVerifierName(person))
            : api.verify(who, documentId, page.id),
      );
    },
    /** Owner or Always in Context. Rejects, rolled back, on a refusal. */
    setFields(
      who: KnowledgeCaller,
      documentId: string,
      page: KnowledgePage,
      patch: PageKnowledgePatch,
      now: number,
    ): Promise<PageKnowledge> {
      const next = patched(fieldsOfPage(page), patch);
      return write(
        documentId,
        page,
        next,
        (was) => withFields(was, next, reviewEveryOf(documentId), now),
        () => api.set(who, documentId, page.id, patch),
      );
    },
    /** Approval (approval.md): request, withdraw, approve (which verifies) or reject, by `person` in person. Shown
     *  at once; rejects, rolled back, on a refusal. */
    approval(
      who: KnowledgeCaller,
      documentId: string,
      page: KnowledgePage,
      action: ApprovalAction,
      person: { account: string; role: 'edit' | 'participate' },
      now: number,
      note?: string,
    ): Promise<PageKnowledge> {
      const next = applyApproval(fieldsOfPage(page), action, { ...person, agent: null }, now, note);
      return write(
        documentId,
        page,
        next,
        (was) => ({
          ...withFields(was, next, reviewEveryOf(documentId), now),
          ...(action === 'approve' ? { changedSinceVerified: false } : {}),
        }),
        () => (api.approval ?? apiPageApproval)(who, documentId, page.id, action, note),
      );
    },
  };

  function fieldsOfPage(page: KnowledgePage): KnowledgeFields {
    const fields = fieldsOf(page);
    return fields && typeof fields === 'object' ? { ...(fields as KnowledgeFields) } : {};
  }
}

export type PageKnowledgeStore = ReturnType<typeof createPageKnowledgeStore>;

/** The editor's one store: a page's health is kept for the session. */
export const pageKnowledgeStore = createPageKnowledgeStore();
