// Item store bounds (docs/specs/026-plan/items.md "Limits"; provenance and
// safe ranges in docs/specs/026-plan/blueprints/item-store.md "Constants").

export const ITEMS_MAX = 5000;
// Room for every built-in field at its limit beside a formatted 9,000-character Long Text, whose runs roughly double
// it (owner 2026-11-15, Work Tracker 944; was 16 KB).
export const ITEM_FIELDS_BYTES = 65_536;
// Every card's stored fields together (items.md "Limits", Work Tracker 944): the whole plan still loads in one GET, and
// 16 MiB answers 17.1 MB at 5,000 cards, raising 72 MB of a Worker's 128 (blueprint item-store.md "Performance and limits").
export const PLAN_FIELDS_BYTES = 16 * 1024 * 1024;
export const ITEM_FIELDS_MAX = 64;
export const ITEM_TITLE_MAX = 500;
export const ITEM_DESCRIPTION_MAX = 10_000;
// A custom Long Text field holds what the Description holds (docs/specs/026-plan/item-types.md "Custom field kinds").
export const ITEM_LONG_TEXT_MAX = ITEM_DESCRIPTION_MAX;
export const ITEM_LABELS_MAX = 12;
export const ITEM_LABEL_MAX = 32;
export const ITEM_CHECKLIST_MAX = 50;
export const ITEM_CHECKLIST_TEXT_MAX = 200;
export const ITEM_STATUS_MAX = 40;
// A card's Attachments (docs/specs/026-plan/items.md "Attachments"): how many pictures, each name's length as the field
// keeps it (20 at the longest still fit ITEM_FIELDS_BYTES), and the largest size an entry may state: the most any
// tier's upload may be with Pro on (25 MB, TIER_LIMITS' imageMaxBytes in @liveworkspace/subscription, repeated here so
// this package stays free of dependencies; pinned by routes/images-pro.test.ts in the api). What one upload may be is
// the images route's to hold (10 MB, or the tier's with Pro on); this only bounds what a card may say of a picture.
// ITEM_ATTACHMENT_BYTES_LEGACY is the bound from before Pro (the media service's 10 MiB): a write is held to it with
// Pro off (the api passes it as an ItemWriteBounds, write-checks.ts), so nothing changes there.
export const ITEM_ATTACHMENTS_MAX = 20;
export const ITEM_ATTACHMENT_NAME_MAX = 120;
export const ITEM_ATTACHMENT_BYTES_MAX = 25_000_000;
export const ITEM_ATTACHMENT_BYTES_LEGACY = 10 * 1024 * 1024;
export const ITEM_ATTACHMENT_ID_MAX = 200;
// A custom Text field's text, and each string in a custom field's list. The store cannot tell a Text field from a Long
// Text one, so it holds a custom field's own string to ITEM_LONG_TEXT_MAX; the doors that know the kind (the card
// panel, the agents' naming, imports) hold a Text field to this.
export const ITEM_UNKNOWN_STRING_MAX = 2000;
export const ITEM_UNKNOWN_ARRAY_MAX = 50;
// The most people or cards a field that holds several keeps (docs/specs/026-plan/item-types.md "Holds Several"): as
// many as a card's labels.
export const FIELD_VALUES_MAX = 20;
export const ITEM_NUMBER_MAX = 999;
export const ITEM_BULK_MAX = 200;
export const ITEM_VOTERS_MAX = 500;
export const ITEM_VOTES_PER_PERSON_MAX = 99;
// A custom assignee's name as the card panel takes it (docs/specs/026-plan/items.md "Custom assignees").
export const CUSTOM_ASSIGNEE_NAME_MAX = 60;
export const ITEM_WRITE_RETRIES = 3;
// The highest key a create may name (a restore, sync or copy keeps its keys); past it the next key is given.
export const ITEM_KEY_MAX = 1_000_000;
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
