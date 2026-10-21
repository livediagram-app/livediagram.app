// Where a document goes when its template is picked after creation (docs/specs/013-workspace/default-folders.md
// "A template picked after creation"). Pure: the wizard's handoff, the template's creation intent, where the document
// sits now, and the person's defaults over the folders they can see go in; the folder to move it to comes out, or
// null to leave it. The same precedence as a create (kind, then template, then mode default), read by the same
// resolveDefaultFor the wizard pre-selects with.
import type { CreationIntent, DocumentPlacement } from '@liveplanner/api-schema';
import {
  resolveDefaultFor,
  type DefaultFolderIndex,
  type PlacementDefaults,
  type ResolvedDefault,
} from './default-destination';
import type { TemplatePickHandoff } from './template-pick-handoff';

export function templatePickMoveTarget(at: {
  handoff: TemplatePickHandoff | null;
  intent: CreationIntent;
  current: DocumentPlacement;
  defaults: PlacementDefaults;
  index: DefaultFolderIndex;
}): ResolvedDefault | null {
  // Only a document the wizard just made, filed by no choice of the person's.
  if (!at.handoff || at.handoff.placementChosen) return null;
  const { resolved } = resolveDefaultFor(at.intent, at.defaults, at.index);
  if (!resolved) return null;
  // Already there (the mode's default and the template's are the same folder): nothing to move.
  const here =
    resolved.folder.id === at.current.folderId && resolved.folder.teamId === at.current.teamId;
  return here ? null : resolved;
}
