// Whether Publish to the Web is offered at all (docs/specs/030-knowledgebase/publishing.md "Who may publish",
// blueprint P1): the one capability check. The api refuses `publishing_unavailable` when it answers false, and the
// editor hides the menu row. Free for every knowledgebase now; the owner may make it a paid feature later, and a tier
// gate is a change to this body alone.

/** The knowledgebase whose publishing is asked about, by its owner and team. */
export type PublishingOwner = { ownerId: string; teamId: string | null };

/** True when this knowledgebase may be published. */
export function publishingOffered(_owner: PublishingOwner): boolean {
  return true;
}
