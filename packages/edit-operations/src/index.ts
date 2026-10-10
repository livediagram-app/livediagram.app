// @livediagram/edit-operations: the engine a changeset runs on
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
export { graphBodyIssue } from './graph-body';
export { formatResultFooter, formatResultLines } from './format-results';
export { formatRejections } from './rejections';
export { EDIT_MAX_ERRORS, EDIT_OPERATION_NAMES, type EditOperationName } from './vocabulary';
export type {
  AddElementOperation,
  AddKindOperation,
  AddOperation,
  ConnectOperation,
  Fields,
  InsertOperation,
  LayoutOperation,
  MoveOperation,
  OrderOperation,
  Placement,
  RewireOperation,
  TestOperation,
  UnwrapOperation,
  WrapOperation,
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
export * from './illustrate';
