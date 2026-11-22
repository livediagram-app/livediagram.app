// Whether a tab may show the knowledgebase's start screen (docs/specs/030-knowledgebase/describe-to-set-up.md "The
// start screen"): to someone who can edit, outside zen and embed, with no draw tool armed, while the tab is still the
// one page a new knowledgebase opens on, an article page with nothing written beyond its Title. Whether it is offered
// at all (only on the knowledgebase /new just made) is knowledgebase-start.ts's; a page of no kind never shows it, as
// such a tab is read as an empty article page (withKnowledgebasePage).

export function showsTemplateStart(at: {
  hydrated: boolean;
  zen: boolean;
  embed: boolean;
  readOnly: boolean;
  drawToolArmed: boolean;
  elementCount: number;
  // The tab is one article page whose writing holds nothing beyond its Title.
  untouchedPage: boolean;
}): boolean {
  if (!at.hydrated || at.zen || at.embed || at.readOnly || at.drawToolArmed) return false;
  if (at.elementCount > 0) return false;
  return at.untouchedPage;
}
