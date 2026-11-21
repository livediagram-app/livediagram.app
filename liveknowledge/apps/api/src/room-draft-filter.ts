// What the room withholds of a page's draft from a session that cannot edit (docs/specs/030-knowledgebase/editing.md
// "Share roles"; blueprint blueprints/editing.md "Security and trust"): a Viewer or a link visitor is never sent the
// draft's writing, nor its record. Pure, so each rule is tested without a socket; the room applies it per socket in
// `frameFor` and in the catch-up replay, as it applies a tab scope.
import { DRAFT_FLOW, withoutDraft } from '@liveknowledge/document';

type LooseOp = {
  kind?: unknown;
  flow?: unknown;
  tab?: unknown;
  patch?: unknown;
  clear?: unknown;
  pageSteps?: unknown;
};

/** The op as a session that cannot edit should see it: the same op when it carries nothing of a draft, a copy
 *  without it, or null to withhold it whole. */
export function opForReader(op: unknown): unknown {
  if (typeof op !== 'object' || op === null) return op;
  const o = op as LooseOp;
  if (o.kind === 'article') return o.flow === DRAFT_FLOW ? null : op;
  if (o.kind === 'tab' && typeof o.tab === 'object' && o.tab !== null) {
    const tab = withoutDraft(o.tab);
    return tab === o.tab ? op : { ...o, tab };
  }
  if (o.kind === 'tab-meta' && typeof o.patch === 'object' && o.patch !== null) {
    if (!Object.hasOwn(o.patch, 'draft')) return op;
    const { draft: _draft, ...patch } = o.patch as Record<string, unknown>;
    void _draft;
    const rest = Object.keys(patch).length > 0;
    const clears = Array.isArray(o.clear) && o.clear.some((k) => k !== 'draft');
    if (!rest && !clears && o.pageSteps === undefined) return null;
    return { ...o, patch };
  }
  return op;
}

/** Whether a session's role reads the draft: an Editor's alone. */
export const roleReadsDraft = (role: unknown): boolean => role === 'edit';
