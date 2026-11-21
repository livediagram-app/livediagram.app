// The person who creates a page owns it (docs/specs/030-knowledgebase/verification.md "The owner"). The api sets the
// owner on the save that makes a page, but the pages a new knowledgebase is created with (/new's blank page, a
// template's pages, the Start Here a structure takes the place of) arrive in the create, which keeps what they carry.
// So /new seeds each with its creator: a signed-in person's account id. A guest or Offline create passes none, and a
// page that already says who owns it keeps that.
import type { Tab } from '@liveknowledge/document';

export function withCreatorOwner<T extends Tab>(tabs: readonly T[], creator: string | null): T[] {
  if (!creator) return [...tabs];
  return tabs.map((tab) =>
    tab.knowledge?.owner ? tab : { ...tab, knowledge: { ...tab.knowledge, owner: creator } },
  );
}
