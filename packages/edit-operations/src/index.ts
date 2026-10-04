// @livediagram/edit-operations: the engine a changeset runs on
// (docs/specs/024-agents/edit-operations.md, blueprint "Interfaces and contracts"). This build
// applies `add` (a whole element), `set` and `rm` addressed by element id, and `replace`; the line
// form and the rest of the vocabulary arrive with the full engine.

export { validateEditOperation, validateEditOperations } from './parse-json';
export { applyEditOperations } from './apply';
export { applyReplace } from './replace';
export { formatResultFooter, formatResultLines } from './format-results';
export { formatRejections } from './rejections';
export {
  APPLIED_OPERATION_NAMES,
  EDIT_MAX_ERRORS,
  EDIT_OPERATION_NAMES,
  type AppliedOperationName,
  type EditOperationName,
} from './vocabulary';
export type {
  AddOperation,
  ApplyOptions,
  ApplyOutcome,
  ApplyRejection,
  ApplySuccess,
  EditLog,
  EditOperation,
  FieldValue,
  ParseOutcome,
  ReplaceBody,
  ReplaceOptions,
  ResultFooter,
  RmOperation,
  Selector,
  SetOperation,
} from './types';
export {
  EDIT_REJECTION_CODES,
  EDIT_WARNING_CODES,
  type EditRejection,
  type EditRejectionCode,
  type EditWarning,
  type EditWarningCode,
  type FieldChange,
  type ResultLine,
} from '@livediagram/api-schema';
