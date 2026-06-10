// Lazy sweep of every joined team's shared library (spec/35), one
// fetch per team, consumed by three surfaces:
//   - the search panel's Folders group (team folders, spec/09),
//   - the move modal's team destinations,
//   - the explorer's Recent list (team diagrams ride alongside the
//     personal ones, badged "Team").
// Runs only while `enabled` (search open / move modal open / Recent
// selected) so sessions that touch none of those never pay the
// requests. Best-effort: a team whose fetch fails contributes no rows
// this round; the sweep re-arms when the team list changes.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Folder } from '@livediagram/api-schema';
import { apiGetTeamLibrary, type DiagramListItem } from '@/lib/api-client';

// `path` stays for the search panel's flat "Marketing / Q3" labels;
// `name` + `parentId` let tree consumers (the sidebar + move modal)
// rebuild the folder hierarchy with indentation instead of paths.
export type TeamFolderRow = {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  teamId: string;
  teamName: string;
};
export type TeamDiagramRow = DiagramListItem & { team: { id: string; name: string } };

// Breadcrumb path per folder ("Marketing / Q3") from the flat
// parentId list. Cycle-guarded the same way the explorer's
// breadcrumb walk is (a malformed chain stops rather than spins).
function folderPaths(folders: Folder[]): Map<string, string> {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const out = new Map<string, string>();
  for (const f of folders) {
    const names: string[] = [];
    const seen = new Set<string>();
    let cur: Folder | undefined = f;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      names.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    out.set(f.id, names.join(' / '));
  }
  return out;
}

export function useTeamLibrariesSweep(
  ownerId: string | null,
  teams: { id: string; name: string }[],
  opts: { enabled: boolean },
): { teamFolders: TeamFolderRow[]; teamDiagrams: TeamDiagramRow[]; refresh: () => void } {
  const { enabled } = opts;
  const [teamFolders, setTeamFolders] = useState<TeamFolderRow[]>([]);
  const [teamDiagrams, setTeamDiagrams] = useState<TeamDiagramRow[]>([]);
  // One sweep per (owner, team-id set, nonce) while enabled; re-arms
  // when the team list changes so a freshly joined team's library
  // appears, and when `refresh` bumps the nonce after a mutation
  // (move within team / remove from team) so consumers repaint.
  const sweptKeyRef = useRef<string | null>(null);
  const [sweepNonce, setSweepNonce] = useState(0);
  const refresh = useCallback(() => setSweepNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || !ownerId || teams.length === 0) return;
    const key = `${ownerId}|${sweepNonce}|${teams
      .map((t) => t.id)
      .sort()
      .join(',')}`;
    if (sweptKeyRef.current === key) return;
    sweptKeyRef.current = key;
    let cancelled = false;
    void Promise.all(
      teams.map(async (team) => {
        try {
          const lib = await apiGetTeamLibrary(ownerId, team.id);
          const paths = folderPaths(lib.folders);
          return {
            folders: lib.folders.map((f) => ({
              id: f.id,
              name: f.name,
              parentId: f.parentId,
              path: paths.get(f.id) ?? f.name,
              teamId: team.id,
              teamName: team.name,
            })),
            diagrams: lib.diagrams.map((d) => ({
              id: d.id,
              name: d.name,
              folderId: d.folderId,
              savedAt: d.savedAt,
              shareCode: d.shareCode,
              ownerId: d.ownerId,
              team: { id: team.id, name: team.name },
            })),
          };
        } catch {
          return { folders: [] as TeamFolderRow[], diagrams: [] as TeamDiagramRow[] };
        }
      }),
    ).then((perTeam) => {
      if (cancelled) return;
      setTeamFolders(perTeam.flatMap((t) => t.folders));
      setTeamDiagrams(perTeam.flatMap((t) => t.diagrams));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, ownerId, teams, sweepNonce]);

  return { teamFolders, teamDiagrams, refresh };
}
