// `applyEditOperations` (docs/specs/024-agents/blueprints/edit-operations.md "The pipeline"): the
// count, the tab lock, each operation in order against the working state, finalise and validate,
// then the element ops, their inverse and the result lines. It stops at the first refusal and then
// returns no tab: a changeset applies whole or not at all (I1). Pure and deterministic (I5): no
// clock, no randomness beyond `options.makeId`.

import { CHANGESET_MAX_OPERATIONS, type EditRejection } from '@livedesign/api-schema';
import { diffToElementOps, invertElementOps, type ElementId, type Tab } from '@livedesign/design';
import { finalise } from './finalise';
import { applyAdd } from './operations/add';
import { applyAddKind } from './operations/add-kind';
import { applyConnect, applyRewire } from './operations/connect';
import { applyInsert } from './operations/insert';
import { applyLayout } from './operations/layout';
import { applyMove } from './operations/move';
import { applyOrder } from './operations/order';
import { applyTest } from './operations/test-fields';
import { applyUnwrap } from './operations/unwrap';
import { applyWrap } from './operations/wrap';
import { applyRm } from './operations/rm';
import { applySet } from './operations/set';
import { buildResultLines } from './results';
import { tabLocked, tooLarge } from './rejections';
import { EDIT_MAX_ERRORS } from './vocabulary';
import { createState, type EditState } from './state';
import type { ApplyOptions, ApplyOutcome, ApplyRejection, EditLog, EditOperation } from './types';

const silent: EditLog = () => {};

function applyOperation(
  state: EditState,
  operation: EditOperation,
  index: number,
): EditRejection | null {
  switch (operation.op) {
    case 'add':
      return 'element' in operation
        ? applyAdd(state, operation, index)
        : applyAddKind(state, operation, index);
    case 'set':
      return applySet(state, operation, index);
    case 'rm':
      return applyRm(state, operation, index);
    case 'move':
      return applyMove(state, operation, index);
    case 'connect':
      return applyConnect(state, operation, index);
    case 'rewire':
      return applyRewire(state, operation, index);
    case 'insert':
      return applyInsert(state, operation, index);
    case 'unwrap':
      return applyUnwrap(state, operation, index);
    case 'order':
      return applyOrder(state, operation, index);
    case 'test':
      return applyTest(state, operation, index);
    case 'layout':
      return applyLayout(state, operation, index);
    case 'wrap':
      return applyWrap(state, operation, index);
  }
}

function rejected(
  log: EditLog,
  rejection: EditRejection,
  operations: readonly EditOperation[],
): ApplyRejection {
  const at = rejection.operation;
  const op = at === undefined ? 'none' : operations[at - 1]!.op;
  log('[edit-ops] rejected', { code: rejection.code, operation: at ?? 0, op });
  return { errors: [rejection] };
}

// The id an operation names for what it makes (`add … id=`, `connect … id=`), if any. A raw-element `add` is never
// skipped (it misses no target), so its own id needs no entry.
function madeId(operation: EditOperation): string | undefined {
  return 'id' in operation && typeof operation.id === 'string' ? operation.id : undefined;
}

// A miss on an id an earlier skipped operation would have made: that operation is the one to fix.
function fromSkipped(rejection: EditRejection, unmade: ReadonlyMap<string, number>): EditRejection {
  for (const [id, at] of unmade) {
    if (rejection.details?.[0] !== `"${id}" matches nothing`) continue;
    return {
      ...rejection,
      details: [`"${id}" was to be made by operation ${at}, which was skipped above`],
      hint: `fix operation ${at}; this one may then stand as written`,
    };
  }
  return rejection;
}

export function applyEditOperations(
  tab: Tab,
  operations: readonly EditOperation[],
  options: ApplyOptions = {},
): ApplyOutcome {
  const log = options.log ?? silent;
  if (operations.length > CHANGESET_MAX_OPERATIONS)
    return rejected(log, tooLarge(operations.length), operations);
  if (tab.locked) {
    log('[edit-ops] locked', { operation: 0, op: 'none', scope: 'tab' });
    return rejected(log, tabLocked(), operations);
  }
  const state = createState(tab, options, log);
  // A target that matches nothing is skipped and the rest read on, so one answer names every such target and a long
  // changeset is fixed in one retry, not one per wrong ref; any other rejection stops at once, and is answered too.
  // Nothing is written while one remains. At most EDIT_MAX_ERRORS are gathered, as the parser's own list is: each
  // miss scans the tab for the nearest candidates, so a changeset of misses is bounded work.
  const unmatched: EditRejection[] = [];
  // The ids a skipped operation would have made, so a later miss on one says so rather than sending the agent to fix
  // a line that is right.
  const unmade = new Map<string, number>();
  let stoppedBy: EditRejection | null = null;
  for (const [index, operation] of operations.entries()) {
    const rejection = applyOperation(state, operation, index + 1);
    if (!rejection) continue;
    if (rejection.code !== 'target_not_found') {
      if (!unmatched.length) return rejected(log, rejection, operations);
      stoppedBy = rejection;
      break;
    }
    unmatched.push(fromSkipped(rejection, unmade));
    const made = madeId(operation);
    if (made !== undefined) unmade.set(made, index + 1);
    if (unmatched.length >= EDIT_MAX_ERRORS) break;
  }
  // Logged as the first is (with how many there are), then answered with them all.
  if (unmatched.length) {
    log('[edit-ops] unmatched', { count: unmatched.length, stopped: stoppedBy?.code ?? 'none' });
    return {
      errors: [
        ...rejected(log, unmatched[0]!, operations).errors,
        ...unmatched.slice(1),
        ...(stoppedBy ? [stoppedBy] : []),
      ],
    };
  }
  const next = finalise(state, log);
  if ('code' in next) return rejected(log, next, operations);
  const elementOps = diffToElementOps(tab.elements, next.elements);
  const results = buildResultLines({ ...state, beforeElements: tab.elements }, next.elements);
  const present = new Set<ElementId>(next.elements.map((el) => el.id));
  const count = (mark: string) => results.filter((line) => line.mark === mark).length;
  log('[edit-ops] applied', {
    operations: operations.length,
    added: count('+'),
    changed: count('~'),
    removed: count('-'),
    moved: count('»'),
    warnings: state.warnings.length,
  });
  return {
    tab: next,
    results,
    elementOps,
    inverse: invertElementOps(tab.elements, elementOps),
    warnings: state.warnings,
    targets: state.targets,
    createdIds: state.created.filter((id) => present.has(id)),
  };
}
