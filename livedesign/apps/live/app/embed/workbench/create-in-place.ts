// New design in a workspace frame (docs/specs/013-workspace/workbench-embeds.md "What renders", blueprint "New
// design in place", WB58): never the /new wizard. The wizard's href says where and what (`folder`, `team`,
// `template`); the place the frame shows fills in where it says nothing, a folder view its folder and a team page its
// team. The design is made as /new makes it (lib/new-design-content.ts) and opened in the frame.
import { creationIntentOf } from '@livedesign/api-schema';
import { untitledNameForTemplate, type TemplateKind } from '@livedesign/templates';
import { apiCreateDesign } from '@/lib/api-client';
import { NEW_DESIGN_THEME_ID, newDesignContent } from '@/lib/new-design-content';
import { newDesignKind } from '@/lib/new-design-params';
import type { WorkspacePlace } from '@/lib/workbench/workspace-place';

export type CreateInPlace = {
  // A folder; `null` the root chosen on purpose; `undefined` no choice, where a default folder may answer.
  folderId: string | null | undefined;
  teamId: string | null;
  // The template the href names; null makes a blank that opens on the editor's start, with the templates.
  templateKind: TemplateKind | null;
};

export function createInPlaceOf(
  href: string,
  origin: string,
  place: WorkspacePlace,
): CreateInPlace {
  const search = new URL(href, origin).searchParams;
  const templateKind = newDesignKind(search.toString());
  const folder = search.get('folder');
  const team = search.get('team');
  if (folder || team) return { folderId: folder ?? undefined, teamId: team, templateKind };
  if (place.kind === 'explorer' && place.node.kind === 'folder')
    return { folderId: place.node.id, teamId: null, templateKind };
  if (place.kind === 'explorer' && place.node.kind === 'team')
    return { folderId: null, teamId: place.node.id, templateKind };
  return { folderId: undefined, teamId: null, templateKind };
}

// Makes the design and answers its id; throws when the api refuses or cannot be reached.
export async function createDesignInPlace(
  ownerId: string,
  request: CreateInPlace,
): Promise<string> {
  const { templateKind } = request;
  const designId = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const { tabs, tab } = await newDesignContent({
    templateKind,
    themeId: NEW_DESIGN_THEME_ID,
    tabId,
    // No template asked for: the editor opens on its start, where the templates are.
    templateChosen: templateKind !== null,
  });
  await apiCreateDesign(ownerId, {
    id: designId,
    name: untitledNameForTemplate(templateKind),
    tabs: tabs ?? [tab],
    teamId: request.teamId,
    folderId: request.folderId,
    intent: creationIntentOf(tab),
  });
  return designId;
}
