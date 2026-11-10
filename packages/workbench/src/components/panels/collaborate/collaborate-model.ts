// The Collaborate panel's pure view model (docs/specs/012-collaboration/assigned-actions.md §5): which rows
// each side shows, how they group into For You / Everything Else, what the
// kind chips count, and the empty-state copy. Pure so every rule is testable
// without rendering the panel.

export type CollaborateSide = 'open' | 'resolved';
export type CollaborateKind = 'all' | 'comments' | 'actions';

// The parts of the panel's comment and action rows these rules read; each editor's rows
// (components/panels/CollaboratePanel.tsx) carry more, and come back as they went in.
type CommentRowFacts = { resolved: boolean; latestAt: number };
type ActionRowFacts = { status: string; createdAt: number; mine: boolean };

// One merged, sortable list entry.
type CollaborateRow<C extends CommentRowFacts, A extends ActionRowFacts> =
  | { kind: 'comment'; at: number; mine: false; comment: C }
  | { kind: 'action'; at: number; mine: boolean; action: A };

type CollaborateSection<R> = {
  key: 'mine' | 'rest' | 'all';
  label: string | null;
  rows: R[];
};

const isOpenComment = (c: CommentRowFacts) => !c.resolved;
const isOpenAction = (a: ActionRowFacts) => a.status === 'open';

// Your own actions first, then everything newest-first on its own timestamp
// (an action's createdAt, a thread's latest comment).
function merge<C extends CommentRowFacts, A extends ActionRowFacts>(
  comments: C[],
  actions: A[],
): CollaborateRow<C, A>[] {
  return [
    ...comments.map((c): CollaborateRow<C, A> => ({
      kind: 'comment',
      at: c.latestAt,
      mine: false,
      comment: c,
    })),
    ...actions.map((a): CollaborateRow<C, A> => ({
      kind: 'action',
      at: a.createdAt,
      mine: a.mine,
      action: a,
    })),
  ].sort((a, b) => (a.mine === b.mine ? b.at - a.at : a.mine ? -1 : 1));
}

export function rowsFor<C extends CommentRowFacts, A extends ActionRowFacts>(
  side: CollaborateSide,
  kind: CollaborateKind,
  comments: C[],
  actions: A[],
): CollaborateRow<C, A>[] {
  const open = side === 'open';
  return merge(
    kind === 'actions' ? [] : comments.filter((c) => isOpenComment(c) === open),
    kind === 'comments' ? [] : actions.filter((a) => isOpenAction(a) === open),
  );
}

// The kind chips' counts for one side. The chips only show when the tab has
// BOTH kinds at all (`showKindChips`): with one kind there is nothing to narrow.
export function kindCounts(
  side: CollaborateSide,
  comments: readonly CommentRowFacts[],
  actions: readonly ActionRowFacts[],
): Record<CollaborateKind, number> {
  const open = side === 'open';
  const c = comments.filter((r) => isOpenComment(r) === open).length;
  const a = actions.filter((r) => isOpenAction(r) === open).length;
  return { all: c + a, comments: c, actions: a };
}

export function showKindChips(comments: readonly unknown[], actions: readonly unknown[]): boolean {
  return comments.length > 0 && actions.length > 0;
}

// Open view: your own actions under For You, the rest under Everything Else.
// Headings only when BOTH groups have rows; a single group needs no label.
export function sectionsFor<R extends { mine: boolean }>(
  side: CollaborateSide,
  rows: R[],
): CollaborateSection<R>[] {
  if (side === 'resolved') return [{ key: 'all', label: null, rows }];
  const mine = rows.filter((r) => r.mine);
  const rest = rows.filter((r) => !r.mine);
  if (mine.length === 0 || rest.length === 0) return [{ key: 'all', label: null, rows }];
  return [
    { key: 'mine', label: 'For You', rows: mine },
    { key: 'rest', label: 'Everything Else', rows: rest },
  ];
}

export function emptyCopy(
  side: CollaborateSide,
  kind: CollaborateKind,
): { heading: string; line: string } {
  if (side === 'open') {
    if (kind === 'comments')
      return { heading: 'No Open Comments', line: 'Every thread on this tab is resolved.' };
    if (kind === 'actions')
      return { heading: 'No Open Actions', line: 'Every action on this tab is done.' };
    return {
      heading: 'All Caught Up',
      line: 'Nothing open on this tab. New comments and actions show up here.',
    };
  }
  if (kind === 'comments')
    return { heading: 'No Resolved Comments', line: 'Resolved threads collect here.' };
  if (kind === 'actions')
    return { heading: 'No Completed Actions', line: 'Finished actions collect here.' };
  return {
    heading: 'Nothing Resolved Yet',
    line: 'Finished actions and resolved threads collect here.',
  };
}

// "Priya Shah" -> "Priya", for the "Priya: ..." comment preview.
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
