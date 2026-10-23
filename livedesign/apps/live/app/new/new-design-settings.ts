import type { SaveLocationId } from '@/lib/save-locations';

// Where a design made from /new goes (docs/specs/007-editor/new-design-route.md "One-step wizard"), decided by
// default at commit: nobody is asked.
export type NewDesignSettings = {
  // Where the design is stored (docs/specs/006-design/save-locations.md): the api, or this browser only.
  saveLocation: SaveLocationId;
  // Placement (docs/specs/013-workspace/folders.md "Placement on create"): a `/new?folder=` / `?team=` context, sent
  // explicitly. Both absent without one: no choice, where a default folder may answer
  // (docs/specs/013-workspace/default-folders.md "Precedence").
  folderId?: string | null;
  teamId?: string | null;
  // The folder was the person's own choice (a /new context), so a template picked later on the start screen keeps it
  // (docs/specs/013-workspace/default-folders.md "A template picked after creation").
  placementChosen?: boolean;
};
