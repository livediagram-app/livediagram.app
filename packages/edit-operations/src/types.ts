// The engine's types (docs/specs/024-agents/blueprints/edit-operations.md "Interfaces and
// contracts"). The answer's wire shapes (result lines, warnings, rejections) live in
// @livediagram/api-schema, where the changeset response carries them.

import type { EditRejection, EditWarning, JsonValue, ResultLine } from '@livediagram/api-schema';
import type { ElementId, ElementOp, GraphInput, Tab, ThemeDefinition } from '@livediagram/document';

// A ref, a quoted label, or `key:value` terms; this build matches an exact element id.
export type Selector = string;

// A field's value in the JSON form; `null` unsets the field.
export type FieldValue = JsonValue;

// `add` with a whole raw element, as the MCP's `ops` mode sends: taken as given, its geometry kept.
export type AddOperation = { op: 'add'; element: Readonly<Record<string, unknown>> };

export type SetOperation = {
  op: 'set';
  target: Selector;
  fields: Readonly<Record<string, FieldValue>>;
  all?: true;
};

export type RmOperation = { op: 'rm'; target: Selector; all?: true; keepArrows?: true };

export type EditOperation = AddOperation | SetOperation | RmOperation;

export type ParseOutcome = { operations: EditOperation[] } | { errors: EditRejection[] };

export type EditLog = (
  fingerprint: string,
  fields: Readonly<Record<string, string | number | boolean>>,
) => void;

export type ApplyOptions = {
  // The owner's selection; null: the room was not read.
  selected?: readonly ElementId[] | null;
  // The tab's theme resolved by the caller (custom themes included).
  theme?: ThemeDefinition;
  // Ids no slug can name; default crypto.randomUUID.
  makeId?: () => string;
  log?: EditLog;
};

export type ReplaceOptions = ApplyOptions & { tabId: string; name: string };

export type ReplaceBody =
  | { graph: GraphInput }
  | { mermaid: string }
  | { template: string }
  | { elements: unknown[]; layout?: 'auto' | 'preserve' };

export type ApplySuccess = {
  tab: Tab;
  results: ResultLine[];
  elementOps: ElementOp[];
  inverse: ElementOp[];
  warnings: EditWarning[];
  targets: ElementId[];
  createdIds: ElementId[];
};

export type ApplyRejection = { errors: EditRejection[] };

// Discriminated by `'errors' in outcome`.
export type ApplyOutcome = ApplySuccess | ApplyRejection;

// The last line of a changeset's answer, composed by the api or the CLI from what only they know.
export type ResultFooter =
  | { dryRun: true; rev: number; lint: string }
  | {
      dryRun: false;
      previousRev: number;
      rev: number;
      rebasedOver: number;
      changesetId: string;
      lint: string;
    };
