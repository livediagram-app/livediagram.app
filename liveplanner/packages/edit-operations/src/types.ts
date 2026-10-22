// The engine's types (docs/specs/024-agents/blueprints/edit-operations.md "Interfaces and
// contracts"). The answer's wire shapes (result lines, warnings, rejections) live in
// @liveplanner/api-schema, where the changeset response carries them.

import type { EditRejection, EditWarning, JsonValue, ResultLine } from '@liveplanner/api-schema';
import type { ElementId, ElementOp, Finish, Tab, ThemeDefinition } from '@liveplanner/project';
import type { PlacementRelation } from './vocabulary';
import type { DashboardSpec } from '@liveplanner/templates';

// A ref, a quoted label, or `key:value` terms joined by spaces, all of which must match.
export type Selector = string;

// A field's value in the JSON form; `null` unsets the field.
export type FieldValue = JsonValue;
export type Fields = Readonly<Record<string, FieldValue>>;

// Where `add` and `move` put an element: beside, after, inside or aligned with a reference, or at a
// point relative to the content origin.
// `within` (a frame or lane, from `inside:<frame> right-of:<x>`) says the reference must be inside it; `alignTo`
// (from `below:<frame> align:<x>`) centres the placed box on x across the side.
export type Placement =
  | { rel: PlacementRelation; ref: Selector; gap?: number; within?: Selector; alignTo?: Selector }
  | { rel: 'at'; x: number; y: number };

// `add` with a whole raw element, as the MCP's `ops` mode sends: taken as given, its geometry kept.
export type AddElementOperation = { op: 'add'; element: Readonly<Record<string, unknown>> };

// `add <kind> [id=] key=value… [<placement>]`.
export type AddKindOperation = {
  op: 'add';
  kind: string;
  id?: string;
  fields?: Fields;
  place?: Placement;
};

export type AddOperation = AddElementOperation | AddKindOperation;

export type SetOperation = { op: 'set'; target: Selector; fields: Fields; all?: true };

export type RmOperation = { op: 'rm'; target: Selector; all?: true; keepArrows?: true };

export type MoveOperation = { op: 'move'; target: Selector; all?: true } & (
  { place: Placement } | { by: [number, number] }
);

export type ConnectOperation = {
  op: 'connect';
  from: Selector;
  to: Selector;
  id?: string;
  fields?: Fields;
  again?: true;
};

// One end, or both at once (a reversal never passes through a self-loop).
export type RewireOperation = { op: 'rewire'; target: Selector } & (
  { from: Selector; to?: Selector } | { from?: undefined; to: Selector }
);

export type InsertOperation = {
  op: 'insert';
  kind: string;
  id?: string;
  fields?: Fields;
  between: [Selector, Selector];
};

// At most one of `absorb` and `makeRoom`.
export type WrapOperation = {
  op: 'wrap';
  targets: Selector[];
  in: 'frame' | 'lane';
  id?: string;
  fields?: Fields;
  tidy?: true;
  absorb?: true;
  makeRoom?: true;
};

export type UnwrapOperation = { op: 'unwrap'; target: Selector };

export type OrderOperation = { op: 'order'; target: Selector } & (
  { to: 'front' | 'back' } | { above: Selector } | { below: Selector }
);

export type LayoutOperation = {
  op: 'layout';
  target: Selector;
  style?: 'flow' | 'tree' | 'mindmap';
  direction?: 'down' | 'right';
};

export type TestOperation = { op: 'test'; target: Selector; fields: Fields };

export type EditOperation =
  | AddOperation
  | SetOperation
  | RmOperation
  | MoveOperation
  | ConnectOperation
  | RewireOperation
  | InsertOperation
  | WrapOperation
  | UnwrapOperation
  | OrderOperation
  | LayoutOperation
  | TestOperation;

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

// `themeId` names a created tab's theme by id (custom themes included); it wins over `theme`.
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
