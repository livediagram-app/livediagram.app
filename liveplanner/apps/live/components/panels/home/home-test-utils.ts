// Test fixtures for Home's components: one project, a person, an action, a group, a Jump Back In
// project.
import type {
  HomeAction,
  HomeProject,
  HomeGroup,
  HomePerson,
  HomeVerb,
} from '@liveplanner/api-schema';
import type { JumpBackInItem } from '@/app/explorer/home/home-model';

export const fixtureDoc: HomeProject = {
  projectId: 'd1',
  name: 'Payments architecture',
  via: 'team',
  shareCode: null,
  tabId: null,
  teamId: 't1',
  teamName: 'Platform team',
  folderId: null,
  folderName: null,
  ownerName: 'Priya',
  savedAt: 1,
  empty: false,
};

export const fixturePerson = (id: string, name: string | null = id): HomePerson => ({
  id,
  name,
  color: '#0ea5e9',
});

export const fixtureAction = (
  id: string,
  verb: HomeVerb,
  personId: string,
  occurredAt: number,
  detail: string | null = null,
): HomeAction => ({ id, verb, personId, occurredAt, detail });

export function fixtureGroup(
  over: Partial<HomeGroup> & Pick<HomeGroup, 'actions' | 'people'>,
): HomeGroup {
  const verbs = [...new Set(over.actions.map((a) => a.verb))].map((verb) => ({
    verb,
    count: over.actions.filter((a) => a.verb === verb).length,
  }));
  return {
    ...fixtureDoc,
    id: `${fixtureDoc.projectId}:2026-08-30`,
    day: '2026-08-30',
    summary: over.people.length > 1,
    verbs,
    total: over.actions.length,
    latestAt: over.actions[0]?.occurredAt ?? 0,
    ...over,
  };
}

export const fixtureJumpItem = (
  projectId: string,
  over: Partial<JumpBackInItem> = {},
): JumpBackInItem => ({
  projectId,
  name: `Doc ${projectId}`,
  href: `/project/${projectId}`,
  savedAt: 1,
  empty: true,
  shareCode: null,
  useDays: 1,
  lastUsedAt: 1,
  localOnly: false,
  ...over,
});
