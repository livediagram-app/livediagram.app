// A plan's description (docs/specs/026-plan/plan-overview.md "The description"): plain text everyone who can open
// the plan reads on its Overview. Written by PUT /api/projects/:id/details, read with the project, and relayed to the
// plan's open editors as the room's `project-details` op. One normaliser for the api's write, the editor's save and an
// offline record, so the three never keep a different value.

// The most characters (UTF-16 code units) a description keeps.
export const PROJECT_DESCRIPTION_MAX = 500;

// `raw` as stored: a string trimmed and capped (never cut inside a surrogate pair); anything else is empty.
export function readProjectDescription(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (trimmed.length <= PROJECT_DESCRIPTION_MAX) return trimmed;
  let cut = trimmed.slice(0, PROJECT_DESCRIPTION_MAX);
  const last = cut.charCodeAt(cut.length - 1);
  // A high surrogate at the end has lost its pair: drop it rather than keep half a character.
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return cut.trimEnd();
}

// PUT /api/projects/:id/details answers the description as stored.
export type ProjectDetailsResponse = { description: string };

// The room op a description write sends (a system kind: only the api sends it).
export type ProjectDetailsRoomOp = { kind: 'project-details'; description: string };
