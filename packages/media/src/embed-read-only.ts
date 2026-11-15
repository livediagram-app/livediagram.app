// The embed's read-only flag (liveworkspace/docs/specs/006-media/previews.md "Pasting a share link: GET /oembed"). No
// imports, so an editor's client bundle takes only these few lines (`@liveworkspace/media/embed-read-only`).

// The embed's flag that opens it as a viewer whatever the link's role (embeds.md "Pasting a share link"): an edit link
// pasted into a public page must not hand every reader edit rights.
export const EMBED_READ_ONLY_PARAM = 'readonly';

/** Whether an embed's address (its `location.search`) asks it to open read-only. */
export function isReadOnlyEmbed(search: string): boolean {
  return new URLSearchParams(search).get(EMBED_READ_ONLY_PARAM) === '1';
}

/** Whether the editor, mounted as an embed (`embedMode`), opens read-only here: read once, in the browser. */
export function embedOpensReadOnly(embedMode: boolean): boolean {
  const here = (globalThis as { location?: { search: string } }).location;
  return embedMode && here !== undefined && isReadOnlyEmbed(here.search);
}

/** The role an embed's session runs as: `view` when it opens read-only, whatever the link gave (Editor, Participant
 *  or Viewer); the link's own role otherwise. */
export function embedSessionRole<Role extends string>(
  role: Role,
  readOnly: boolean,
): Role | 'view' {
  return readOnly ? 'view' : role;
}
