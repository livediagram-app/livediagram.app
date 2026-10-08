// Item store bounds (docs/specs/026-plan/items.md "Limits"; provenance and
// safe ranges in docs/specs/026-plan/blueprints/item-store.md "Constants").

export const ITEMS_MAX = 2000;
export const ITEM_FIELDS_BYTES = 16_384;
export const ITEM_FIELDS_MAX = 64;
export const ITEM_TITLE_MAX = 500;
export const ITEM_DESCRIPTION_MAX = 10_000;
export const ITEM_LABELS_MAX = 12;
export const ITEM_LABEL_MAX = 32;
export const ITEM_CHECKLIST_MAX = 50;
export const ITEM_CHECKLIST_TEXT_MAX = 200;
export const ITEM_STATUS_MAX = 40;
export const ITEM_UNKNOWN_STRING_MAX = 2000;
export const ITEM_UNKNOWN_ARRAY_MAX = 50;
export const ITEM_NUMBER_MAX = 999;
export const ITEM_BULK_MAX = 200;
export const ITEM_VOTERS_MAX = 500;
export const ITEM_VOTES_PER_PERSON_MAX = 99;
export const ITEM_WRITE_RETRIES = 3;
// A card's comment thread (docs/specs/026-plan/items.md "Comments"), outside ITEM_FIELDS_BYTES.
export const ITEM_COMMENTS_MAX = 200;
export const ITEM_COMMENTS_BYTES = 131_072;

export const ITEM_ID_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
export const ITEM_FIELD_KEY_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
export const ITEM_TYPE_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

// Board set-up bounds (docs/specs/026-plan/plan-board.md).
export const PLAN_COLUMNS_MAX = 12;
export const PLAN_COLUMN_NAME_MAX = 40;
export const PLAN_WIP_MAX = 99;
export const PLAN_TITLE_MAX = 80;
