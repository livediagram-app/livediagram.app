import { describe, expect, it } from 'vitest';
import { filterSlashItems } from '@/lib/article/article-slash-items';
import { slashInsertEvent } from '@/lib/article/article-telemetry';

// docs/specs/030-knowledgebase/links-and-embeds.md "Embeds from other apps" and "Page links": what the slash menu
// offers for them. The menu itself shows only to an Editor writing (ArticleEditor's `reshape`), so neither is offered
// to a Participant or a Viewer.
describe('the slash menu’s knowledge entries', () => {
  it('offers Embed, found by its name and by each app’s', () => {
    const [embed] = filterSlashItems('embed');
    expect(embed).toMatchObject({
      label: 'Embed',
      group: 'Insert',
      action: { kind: 'insert', what: 'embed' },
    });
    for (const app of ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'])
      expect(filterSlashItems(app).map((i) => i.id)).toContain('embed');
  });

  it('offers Link to Page', () => {
    expect(filterSlashItems('link to')[0]).toMatchObject({
      label: 'Link to Page',
      action: { kind: 'page-link' },
    });
    // Neither is counted as a block insert: the host counts an embed when it lands, and a link when it is chosen.
    expect(slashInsertEvent({ kind: 'page-link' })).toBeNull();
    expect(slashInsertEvent({ kind: 'insert', what: 'embed' })).toBeNull();
  });
});
