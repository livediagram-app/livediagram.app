// @liveplanner/edit-operations: the engine a changeset runs on
// (docs/specs/024-agents/edit-operations.md, blueprint "Interfaces and contracts"): both forms of
// the edit operations, applied to a tab, and `replace`.

export { validateEditOperation, validateEditOperations } from './parse-json';
export { parseEditOperations } from './parse';
export { formatOperation } from './format-operation';
export {
  addableKinds,
  elementFormatText,
  elementKindsText,
  SCHEMA_KIND_MAX_TOKENS,
} from './element-format';
export { applyEditOperations } from './apply';
export { applyReplace } from './replace';
export { formatResultFooter, formatResultLines } from './format-results';
export { formatRejections } from './rejections';
export { EDIT_MAX_ERRORS, EDIT_OPERATION_NAMES, type EditOperationName } from './vocabulary';
export {
  PLAN_COMMON_FIELDS,
  PLAN_ELEMENT_ABOUT,
  PLAN_ELEMENT_KINDS,
  PLAN_KIND_FIELDS,
  isPlanElementKind,
  planElementIssue,
  type PlanElementKind,
} from './plan-elements';
export type {
  AddOperation,
  Fields,
  TestOperation,
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
  type EditRejection,
  type EditRejectionCode,
  type EditWarning,
  type EditWarningCode,
  type FieldChange,
  type ResultLine,
} from '@liveplanner/api-schema';
