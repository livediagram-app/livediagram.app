// Test fixtures for Home's components: one document, a person, an action, a group, a Jump back in
// document.
import type {
  HomeAction,
  HomeDocument,
  HomeGroup,
  HomePerson,
  HomeVerb,
} from '@livediagram/api-schema';
import type { JumpBackInItem } from '@/app/explorer/home/home-model';

export const fixtureDoc: HomeDocument = {
  documentId: 'd1',
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
  pictureUrl: null,
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
    id: `${fixtureDoc.documentId}:2026-08-30`,
    day: '2026-08-30',
    summary: over.people.length > 1,
    verbs,
    total: over.actions.length,
    latestAt: over.actions[0]?.occurredAt ?? 0,
    ...over,
  };
}

export const fixtureJumpItem = (
  documentId: string,
  over: Partial<JumpBackInItem> = {},
): JumpBackInItem => ({
  documentId,
  name: `Doc ${documentId}`,
  href: `/document/${documentId}`,
  savedAt: 1,
  empty: true,
  shareCode: null,
  useDays: 1,
  lastUsedAt: 1,
  localOnly: false,
  ...over,
});
