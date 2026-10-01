// Shape libraries (docs/specs/013-workspace/shape-libraries.md): limits shared by the api, which
// enforces them, and the client, which checks them before any upload.

/** How many shape libraries one owner can keep. */
export const MAX_SHAPE_LIBRARIES_PER_OWNER = 100;
/** How many items one library holds; an import keeps the first ones. */
export const MAX_SHAPE_LIBRARY_ITEMS = 1000;
/** A library's name, trimmed. */
export const MAX_SHAPE_LIBRARY_NAME_CHARS = 120;
/** An item's title. */
export const MAX_SHAPE_LIBRARY_TITLE_CHARS = 200;
