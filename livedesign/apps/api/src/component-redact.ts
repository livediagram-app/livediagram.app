// A main as a reader may see it (docs/specs/009-elements/components.md "Security and trust"): the same redaction a
// tab read gets. A Community visitor gets it without comment threads, their authors or the people on its actions;
// anyone but the owner without other people's comment author ids. Mains rarely carry any (Make Component drops
// threads and adders), but a main written through the api may, and resolve never draws them, so nothing is lost.

import { redactTabForCommunity } from '@liveworkspace/community/app';
import type { DesignComponent } from '@livedesign/design';
import { redactCommentAuthorIds } from './comments';

// `redactFor`: whose own comment author ids stay (every other is blanked); null keeps them all (the owner).
export type MainReader = { community: boolean; redactFor: string | null };

export function mainsForReader(
  mains: readonly DesignComponent[],
  reader: MainReader,
): DesignComponent[] {
  if (reader.community) return mains.map((main) => redactTabForCommunity(main));
  const viewer = reader.redactFor;
  if (viewer === null) return [...mains];
  return mains.map((main) => ({
    ...main,
    elements: redactCommentAuthorIds(main.elements, viewer),
  }));
}
