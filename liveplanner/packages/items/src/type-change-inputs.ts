// What an agent's card type changes say (docs/specs/026-plan/plan-agents.md "Changing card types"), and what applying
// them answers. type-changes.ts re-exports the public ones.
import type { TypeChangeRefusal } from './type-change-refused';
import type { ItemTypeCatalogue } from './type-catalogue';
import type { DisplayInput, TabInput } from './type-change-face';

export interface CustomFieldInput {
  name: string;
  kind: string;
  options?: readonly string[];
  // A Rating field's top score, 3 to 10; 5 when absent.
  scale?: number;
  // A Card field's target card type, by id or name.
  linkType?: string;
  // A Card field's target card types, by id or name (docs/specs/026-plan/item-types.md "Card fields"); merged after
  // `linkType` when both are given.
  linkTypes?: readonly string[];
  // A Currency field's ISO 4217 code; GBP when absent.
  currency?: string;
  // A Calculated field's calculation, by id (`childCount`) or name ("Child Count").
  calculation?: string;
  // A Formula's expression, written with field names, and its result kind (docs/specs/026-plan/item-types.md
  // "Formula fields").
  formula?: string;
  result?: string;
  // A Rollup's or Lookup's settings by name (docs/specs/026-plan/item-types.md "Rollup and Lookup fields"): the Card
  // field it reads through ("all" for a Rollup over every child), what a Rollup works out, and the field it reads.
  through?: string;
  aggregate?: string;
  source?: string;
  // A share drawn as a Percent field is ('percent'), or as text ('number', the default); only where
  // canShowAsPercent allows it (docs/specs/026-plan/item-types.md "Percent").
  showAs?: string;
  // A Duration field that tracks time (docs/specs/026-plan/item-types.md "Time Spent"); set only when it is made.
  timeSpent?: boolean;
  // A Date Range whose ends carry a time (docs/specs/026-plan/item-types.md "Date Range"); set only when it is made.
  withTime?: boolean;
  onCard?: boolean;
  // Required (docs/specs/026-plan/item-types.md "Required fields"); never a checkbox.
  required?: boolean;
  // A Person field tells its person when a card is theirs (item-types.md "Notifies"); only a Person field.
  notifies?: boolean;
  // A Person or Card field holds several people or cards (item-types.md "Holds Several"); only those kinds.
  multiple?: boolean; // A Card field whose cards block the card (item-types.md "Blocked By"); only a Card field. True holds several too.
  blocks?: boolean;
}

// An existing custom field edited in place: renamed, its options replaced (a Choice field), drawn on the card or not.
// Values on cards stay as they are.
export interface CustomFieldEdit {
  field: string;
  name?: string;
  options?: readonly string[];
  // A Card field's card types, replaced whole, by id or name.
  linkTypes?: readonly string[];
  currency?: string;
  // A Calculated field's calculation, by id or name.
  calculation?: string;
  // A Formula's expression (field names) and result kind.
  formula?: string;
  result?: string;
  // A Rollup's or Lookup's settings by name.
  through?: string;
  aggregate?: string;
  source?: string;
  // 'percent' draws its share as a Percent field is, 'number' as text again.
  showAs?: string;
  onCard?: boolean;
  // true makes it required, false optional again.
  required?: boolean;
  // A Person field: true tells its person when a card is theirs, false stops.
  notifies?: boolean;
  // A Person or Card field: true holds several, false holds one (the cards' values are kept as they are).
  multiple?: boolean; // A Card field: true makes its cards block the card (and holds several), false stops (item-types.md "Blocked By").
  blocks?: boolean;
}

// A type's card face and panel (type-change-face.ts), as `add` and `set` take them.
export interface FaceInput {
  display?: DisplayInput;
  tabs?: readonly TabInput[];
  detailsLabel?: string;
}

// Whether the Assignee tells its person when a card is theirs (item-types.md "Notifies"), as `add` and `set` take it;
// absent leaves it as it is.
interface NotifyInput {
  assigneeNotifies?: boolean;
}

export type CardTypeChange =
  | ({
      op: 'add';
      name: string;
      color?: string;
      glyph?: string;
      fields?: readonly string[];
      custom?: readonly CustomFieldInput[];
      defaultStatus?: string;
      // The statuses it uses, in order, by column name or status; absent, every status the boards name.
      statuses?: readonly string[];
      // Its base type, by name or id (docs/specs/026-plan/item-types.md "Inherited types").
      inherits?: string;
    } & FaceInput &
      NotifyInput)
  | ({
      op: 'set';
      type: string;
      name?: string;
      color?: string;
      glyph?: string;
      addFields?: readonly string[];
      removeFields?: readonly string[];
      addCustom?: readonly CustomFieldInput[];
      editCustom?: readonly CustomFieldEdit[];
      removeCustom?: readonly string[];
      // A status, or null to clear the Default State.
      defaultStatus?: string | null;
      // The whole ordered list of the statuses it uses, by column name or status.
      statuses?: readonly string[];
      // A base type to inherit from, by name or id, or null to detach (docs/specs/026-plan/item-types.md "Inherited
      // types").
      inherits?: string | null;
    } & FaceInput &
      NotifyInput)
  | { op: 'delete'; type: string }
  // Any of the five default types the project lacks, after its types (docs/specs/026-plan/plan-agents.md); its
  // older name, `restore_built_ins`, does the same.
  | { op: 'add_default_types' }
  | { op: 'restore_built_ins' };

export type TypeChangesResult =
  | {
      ok: true;
      // The catalogue to store: null leaves the project's card types not chosen (none).
      catalogue: ItemTypeCatalogue | null;
      // One line per change applied.
      applied: string[];
      // The ids of the types deleted, whose cards go to the Trash.
      deleted: string[];
    }
  | ({ ok: false; applied: string[] } & TypeChangeRefusal);
