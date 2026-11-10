// The collab key (each product's docs/specs/013-workspace/share-roles.md "The collab key"): the public id a person's
// dots, responses and comment reactions are recorded under. The server derives it from who they are
// (@liveworkspace/api-kit/collab-key) and pins it on their room session; the room tells the session its own key in a
// `collab-key` frame, which the editor adopts. Both ends check its shape here.

/** A collab key is this many lowercase hex characters. */
export const COLLAB_KEY_LENGTH = 32;

const HEX = /^[0-9a-f]+$/;

/** Whether `value` is a collab key's shape: exactly COLLAB_KEY_LENGTH lowercase hex characters. */
export function isCollabKey(value: unknown): value is string {
  return typeof value === 'string' && value.length === COLLAB_KEY_LENGTH && HEX.test(value);
}

/** The room's word to one session of the key it pinned on it, sent to that socket alone after each `hello`. */
export type CollabKeyMessage = { kind: 'collab-key'; key: string };
