// The engine's types (docs/specs/024-agents/blueprints/edit-operations.md "Interfaces and
// contracts"). The answer's wire shapes (result lines, warnings, rejections) live in
// @liveplanner/api-schema, where the changeset response carries them.

import type { EditRejection, EditWarning, JsonValue, ResultLine } from '@liveplanner/api-schema';
import type { ElementId, ElementOp, Finish, Tab, ThemeDefinition } from '@liveplanner/project';
import type { DashboardSpec } from '@liveplanner/templates';

// A ref, a quoted label, or `key:value` terms joined by spaces, all of which must match.
export type Selector = string;

// A field's value in the JSON form; `null` unsets the field.
export type FieldValue = JsonValue;
export type Fields = Readonly<Record<string, FieldValue>>;

// `add` with a whole element, as the JSON form and the MCP's `ops` mode send it: taken as given, its geometry
// kept. Only the kinds a Plan tab holds are taken (./plan-elements).
export type AddOperation = { op: 'add'; element: Readonly<Record<string, unknown>> };

export type SetOperation = { op: 'set'; target: Selector; fields: Fields; all?: true };

export type RmOperation = { op: 'rm'; target: Selector; all?: true };

export type TestOperation = { op: 'test'; target: Selector; fields: Fields };

export type EditOperation = AddOperation | SetOperation | RmOperation | TestOperation;

export type ParseOutcome = { operations: EditOperation[] } | { errors: EditRejection[] };

export type EditLog = (
  fingerprint: string,
  fields: Readonly<Record<string, string | number | boolean>>,
) => void;

export type ApplyOptions = {
  // The owner's selection; null: the room was not read.
  selected?: readonly ElementId[] | null;
  // The tab's theme resolved by the caller.
  theme?: ThemeDefinition;
  // Ids no slug can name; default crypto.randomUUID.
  makeId?: () => string;
  log?: EditLog;
};

// `themeId` names a created tab's theme by id; it wins over `theme`.
export type ReplaceOptions = ApplyOptions & {
  tabId: string;
  name: string;
  themeId?: string;
  // The new tab's finish (docs/specs/008-canvas/finish.md); only a replace that creates the tab sets one.
  finish?: Finish;
  // A new tab of elements made a Board or Sheet tab (a form's responses, docs/specs/030-forms/forms.md "Agents").
  kind?: 'board' | 'sheet';
};

export type ReplaceBody =
  | { template: string }
  // A new Dashboard tab (docs/specs/026-plan/plan-agents.md "Making a dashboard"); never onto an existing tab.
  | { dashboard: DashboardSpec }
  // A new Form tab's form whole (docs/specs/030-forms/forms.md "Agents"); an existing form changes through its route.
  | { form: unknown }
  // A tab's elements, as the tab JSON gives them: kept where they are.
  | { elements: unknown[] };

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
  | { dryRun: true; rev: number }
  | {
      dryRun: false;
      previousRev: number;
      rev: number;
      rebasedOver: number;
      changesetId: string;
      // The project the changeset belongs to: the revert command names it (CLI26).
      projectId: string;
    };
