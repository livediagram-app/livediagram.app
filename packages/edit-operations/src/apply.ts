// `applyEditOperations` (docs/specs/024-agents/blueprints/edit-operations.md "The pipeline"): the
// count, the tab lock, each operation in order against the working state, finalise and validate,
// then the element ops, their inverse and the result lines. It stops at the first refusal and then
// returns no tab: a changeset applies whole or not at all (I1). Pure and deterministic (I5): no
// clock, no randomness beyond `options.makeId`.

import { CHANGESET_MAX_OPERATIONS, type EditRejection } from '@livediagram/api-schema';
import {
  diffToElementOps,
  invertElementOps,
  type ElementId,
  type Tab,
} from '@livediagram/document';
import { finalise } from './finalise';
import { applyAdd } from './operations/add';
import { applyRm } from './operations/rm';
import { applySet } from './operations/set';
import { buildResultLines } from './results';
import { notAppliedOperation, tabLocked, tooLarge } from './rejections';
import { createState, type EditState } from './state';
import type { ApplyOptions, ApplyOutcome, EditLog, EditOperation } from './types';

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
        : notAppliedOperation('add <kind>', index);
    case 'set':
      return applySet(state, operation, index);
    case 'rm':
      return applyRm(state, operation, index);
    default:
      return notAppliedOperation(operation.op, index);
  }
}

function rejected(
  log: EditLog,
  rejection: EditRejection,
  operations: readonly EditOperation[],
): ApplyOutcome {
  const at = rejection.operation;
  const op = at === undefined ? 'none' : operations[at - 1]!.op;
  log('[edit-ops] rejected', { code: rejection.code, operation: at ?? 0, op });
  return { errors: [rejection] };
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
  for (const [index, operation] of operations.entries()) {
    const rejection = applyOperation(state, operation, index + 1);
    if (rejection) return rejected(log, rejection, operations);
  }
  const next = finalise(state, log);
  if ('code' in next) return rejected(log, next, operations);
  const elementOps = diffToElementOps(tab.elements, next.elements);
  const results = buildResultLines(state, next.elements);
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
