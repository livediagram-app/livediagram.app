// Which comments at a page's foot are the person's own (docs/specs/030-knowledgebase/page-comments.md "Your own
// comment"): each comment names its author by collab key, the one-way id the api derives from the id the editor
// sends as its owner (@liveworkspace/api-kit collab-key.ts). The editor derives its own key the same way, once per
// id, so no account id is ever on the wire and Edit and Delete show only on what the person wrote. Presentation only:
// the api refuses anyone else's comment.
import { COLLAB_KEY_LENGTH } from '@liveworkspace/api-schema/collab-key';
import { sha256Hex } from '@liveworkspace/api-schema/sha256';

const keys = new Map<string, Promise<string>>();

/** The collab key of `person`, as the api derives it. Cached for the session. */
export function ownCommentKey(person: string): Promise<string> {
  let key = keys.get(person);
  if (!key) {
    key = sha256Hex(new TextEncoder().encode(`liveworkspace:collab:v1:${person}`)).then((digest) =>
      digest.slice(0, COLLAB_KEY_LENGTH),
    );
    keys.set(person, key);
  }
  return key;
}
