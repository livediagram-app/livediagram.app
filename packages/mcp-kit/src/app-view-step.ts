// One live view (each product's docs/specs/015-api/mcp-server.md "One live view"): a chat fills with a view per tool
// call, and they would all follow the file to the same picture. A view follows only until an agent's later change
// lands on its tab; from then it keeps its own step. The view learns of it from the room while it listens, and from
// view_tab when it is opened again or catches up: it sends the tab revision its own result left (`rev`), and view_tab
// reads the tab's newest changesets to say whether an agent wrote after it. Pure but for the read each product hands in.
import type { ToolResult } from './tool-result';

// How many of the tab's newest changesets view_tab reads: an agent's is nearly always the newest, and a person's
// reverts after it are few.
export const LATER_STEP_LOOK = 5;

/** A changeset as the api lists it (`ChangesetSummary`), as far as a view's step reads it. */
export type StepChangeset = { rev: number; agent: boolean };

/** The api path listing a tab's newest changesets: `/<collection>/<id>/changesets?tab=<tab>&limit=`. */
export function laterStepPath(collection: string, id: string, tabId: string): string {
  return `/${collection}/${encodeURIComponent(id)}/changesets?tab=${encodeURIComponent(tabId)}&limit=${LATER_STEP_LOOK}`;
}

/** Whether an agent changed the tab after the revision a view's own step left it at. */
export function hasLaterStep(changesets: readonly StepChangeset[], rev: number): boolean {
  return changesets.some((c) => c.agent === true && c.rev > rev);
}

/**
 * Whether a later step landed since `rev`, by the product's own read of the list. A view that sent no revision is not
 * asked, and a read that fails says no: the view then follows the file as it always did.
 */
export async function laterStepSince(
  read: () => Promise<{ changesets?: readonly StepChangeset[] }>,
  rev: number | undefined,
): Promise<boolean> {
  if (rev === undefined) return false;
  try {
    return hasLaterStep((await read()).changesets ?? [], rev);
  } catch {
    return false;
  }
}

/**
 * view_tab's answer to a view that holds its own step's picture once a later step landed: the tab's name and links,
 * and no drawing, which the view would not show.
 */
export function earlierStepResult(
  value: { name: string; tabId: string } & Record<string, unknown>,
): ToolResult {
  console.info('[mcp] view_tab', { superseded: true });
  return {
    content: [
      { type: 'text', text: `Tab "${value.name}" has a later step: the view keeps its own.` },
    ],
    structuredContent: {
      ...value,
      tabs: [],
      svg: '',
      viewBox: { x: 0, y: 0, width: 0, height: 0 },
      elements: [],
      superseded: true,
    },
  };
}

const revOf = (tab: unknown): number | undefined => {
  const rev = (tab as { rev?: unknown } | null | undefined)?.rev;
  return typeof rev === 'number' ? rev : undefined;
};

/**
 * The revision create left its first tab at, for the view it opens and the model's next update: the stored tab's when
 * the create already read it back (a template's tab its elements went onto), and one read of it otherwise. The
 * document is made by then, so a read that fails leaves the revision out and never fails the create.
 */
export async function createdTabRev(
  shown: unknown,
  read: () => Promise<unknown>,
): Promise<{ rev?: number }> {
  let rev = revOf(shown);
  if (rev === undefined) {
    try {
      rev = revOf(await read());
    } catch {
      // Left out: the view then follows as it always did.
    }
  }
  return rev === undefined ? {} : { rev };
}
