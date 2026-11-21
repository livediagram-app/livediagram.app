import { describe, expect, it, vi } from 'vitest';
import { knowledgeKit, page, type Kit, type Who } from './knowledge-test-kit';

// docs/specs/030-knowledgebase/page-surface.md "The page icon": saved with the tab by whoever may edit the page,
// refused to anyone else, settled as it is stored, and answered by the page read an agent makes.
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

const stored = (kit: Kit, tab = 'deploys') =>
  JSON.parse(
    (kit.db.sql.prepare('SELECT data FROM tabs WHERE id = ?').get(tab) as { data: string }).data,
  ) as { icon?: unknown };
const save = (kit: Kit, who: Who, icon: unknown) =>
  kit.call(who, 'PUT', '/api/documents/kb/tabs/deploys', {
    ...page('deploys', 'Deploys', [
      { id: 'b1', type: 'paragraph', style: 'title', runs: [{ text: 'Deploys' }] },
    ]),
    icon,
  });
const readPage = async (kit: Kit, who: Who = 'viewer') =>
  (
    await (
      await kit.call(who, 'GET', '/api/documents/kb/pages/deploys')
    ).json<{
      page: { icon?: unknown };
    }>()
  ).page;

describe('a page’s icon', () => {
  it('rides an Editor’s save and is read back by an agent as its kind', async () => {
    const kit = await knowledgeKit();
    expect((await save(kit, 'editor', { emoji: '🚀' })).status).toBeLessThan(300);
    expect(stored(kit).icon).toEqual({ emoji: '🚀' });
    expect((await readPage(kit)).icon).toEqual({ kind: 'emoji', emoji: '🚀' });
    expect((await save(kit, 'editor', { iconId: 'rocket' })).status).toBeLessThan(300);
    expect((await readPage(kit)).icon).toEqual({ kind: 'icon', iconId: 'rocket' });
  });

  it('drops an icon that is not one, and a page with none reads none', async () => {
    const kit = await knowledgeKit();
    expect('icon' in (await readPage(kit))).toBe(false);
    expect((await save(kit, 'editor', { emoji: 'not an emoji' })).status).toBeLessThan(300);
    expect('icon' in stored(kit)).toBe(false);
  });

  it('is set by a Participant, as by an Editor', async () => {
    const kit = await knowledgeKit();
    expect((await save(kit, 'participant', { emoji: '📚' })).status).toBe(200);
    expect(stored(kit).icon).toEqual({ emoji: '📚' });
  });

  it.each<Who>(['viewer', 'link'])('is refused to a %s', async (who) => {
    const kit = await knowledgeKit();
    expect((await save(kit, who, { emoji: '🚀' })).status).toBe(403);
    expect('icon' in stored(kit)).toBe(false);
  });
});
