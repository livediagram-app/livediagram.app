// Everyone who may edit joins edit mode with the people editing (docs/specs/030-knowledgebase/editing.md "Edit mode";
// owner, 2026-11-21: "everyone joins edit mode", "except viewers of course"): when someone starts editing the page
// this editor shows, or it opens on a page being edited, this editor enters edit mode too and watches the typing live.
// Only a newcomer pulls: after Cancel, the people still editing never pull again until someone else starts.

/** The first person in `now` who was not editing in `before`, or null. Pure: ids in, the newcomer out. */
export function newEditorOf<T extends { id: string }>(
  before: readonly string[],
  now: readonly T[],
): T | null {
  return now.find((p) => !before.includes(p.id)) ?? null;
}
