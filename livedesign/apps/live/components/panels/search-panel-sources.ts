// What the search panel searches across, and how both of its hosts (the Explorer and the editor) shape their lists
// for it. Kept apart from SearchPanel.tsx, which both hosts load lazily: importing this costs no first-load JS.
import { isInThisBrowser } from '@/lib/design-space';

export type SearchPanelDesign = { id: string; name: string; localOnly?: boolean };
export type SearchPanelFolder = { id: string; name: string };
export type SearchPanelShared = { id: string; name: string; shareCode: string };
export type SearchPanelTeam = { id: string; name: string };
export type SearchPanelTeamFolder = { id: string; path: string; teamId: string; teamName: string };
export type SearchPanelTeamDesign = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
};

type Named = { id: string; name: string };

export function searchPanelSources(lists: {
  designs: readonly (Named & { ownerId: string })[];
  folders: readonly Named[];
  shared: readonly (Named & { shareCode: string })[];
  teams: readonly Named[];
  teamDesigns: readonly (Named & { team: Named })[];
}): {
  designs: SearchPanelDesign[];
  folders: SearchPanelFolder[];
  shared: SearchPanelShared[];
  teams: SearchPanelTeam[];
  teamDesigns: SearchPanelTeamDesign[];
} {
  return {
    designs: lists.designs.map((d) => ({
      id: d.id,
      name: d.name,
      localOnly: isInThisBrowser(d),
    })),
    folders: lists.folders.map((f) => ({ id: f.id, name: f.name })),
    shared: lists.shared.map((s) => ({ id: s.id, name: s.name, shareCode: s.shareCode })),
    teams: lists.teams.map((t) => ({ id: t.id, name: t.name })),
    teamDesigns: lists.teamDesigns.map((d) => ({
      id: d.id,
      name: d.name,
      teamId: d.team.id,
      teamName: d.team.name,
    })),
  };
}
