// Required Reading in Insights (docs/specs/030-knowledgebase/required-reading.md "Where it shows"): each page asked
// to be read with how many of its audience confirmed, least read first. Counts only, never who. Two reads (the
// requirements, their confirmations) and the team at most once, kept a minute (reading-people.ts).
import type { KnowledgeRequiredReadingPage } from '@liveknowledge/api-schema';
import type { DocumentDTO, DocumentEnv } from '../types';
import { allConfirmations, allRequirements } from './page-reading';
import { audienceOf } from './reading-people';

export async function readingOverview(
  env: DocumentEnv,
  document: Pick<DocumentDTO, 'ownerId' | 'teamId' | 'tabs'>,
  now: number,
): Promise<KnowledgeRequiredReadingPage[]> {
  const requirements = await allRequirements(env);
  if (requirements.length === 0) return [];
  const confirmations = await allConfirmations(env);
  const titles = new Map(document.tabs.map((t) => [t.id, t.name]));
  const pages: KnowledgeRequiredReadingPage[] = [];
  for (const requirement of requirements) {
    const title = titles.get(requirement.tab);
    // A page in the Trash keeps its rows until it is deleted for good, and is not listed.
    if (title === undefined) continue;
    const confirmed = confirmations.get(requirement.tab) ?? new Set<string>();
    const audience = await audienceOf(env, document, requirement, confirmed, now);
    pages.push({
      tab: requirement.tab,
      title,
      audience: requirement.audience,
      done: audience.ids.filter((id) => confirmed.has(id)).length,
      total: audience.ids.length,
    });
  }
  const share = (p: KnowledgeRequiredReadingPage) => (p.total === 0 ? 1 : p.done / p.total);
  return pages.sort((a, b) => share(a) - share(b) || a.title.localeCompare(b.title, 'en'));
}
