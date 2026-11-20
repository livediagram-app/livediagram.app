// The doors liveknowledge closes on the fork (docs/specs/002-project-scope/not-in-liveknowledge.md "Unreachable, to
// delete"): nothing here makes, lays out or presents a slide or an infographic.
import { describe, expect, it } from 'vitest';
import { TEMPLATES, isTemplateKind, templatePageKind } from '@liveknowledge/templates';
import { newKnowledgebasePageContent, pagesOf, type Tab } from '@liveknowledge/document';
import { PAGES_FORMATS } from '@/components/dialogs/export-formats';
import { TEMPLATE_START } from '@/components/start/start-template-items';
import { SETTINGS_CATEGORIES } from '@/components/dialogs/settings/settings-catalogue';
import { pageEdits } from '@/hooks/editor/page-edits';
import { dropImportHint } from './drop-import-hint';
import { importFormatsFor } from './import-formats';
import { CUT_FROM_FORK } from './not-in-liveknowledge';

describe('what liveknowledge does not offer', () => {
  it('keeps every door closed', () => {
    expect(CUT_FROM_FORK).toBe(false);
  });

  it('lists only templates of writing, in the catalogue and on the start', () => {
    for (const t of TEMPLATES) expect(templatePageKind(t.kind), t.kind).toBe('article');
    for (const kind of ['slide-deck', 'blank-slide-deck', 'blank-infographic', 'event-poster'])
      expect(isTemplateKind(kind), kind).toBe(false);
    const started = TEMPLATE_START.groups.flatMap((g) => g.kinds);
    expect(started.length).toBeGreaterThan(0);
    for (const kind of started) expect(templatePageKind(kind), kind).toBe('article');
  });

  it('imports and exports no PowerPoint', () => {
    const page = { elements: [], ...newKnowledgebasePageContent() };
    expect(importFormatsFor(page)).toEqual(['json', 'markdown', 'word']);
    expect(importFormatsFor({ elements: [] })).toEqual(['json', 'markdown', 'word']);
    expect(PAGES_FORMATS).not.toContain('pptx');
    expect(dropImportHint({ name: 'deck.pptx' })).toBeNull();
  });

  it('has no settings for presenting or for a list of paper pages', () => {
    expect(SETTINGS_CATEGORIES.map((c) => c.id)).not.toContain('presenting');
    const keys = SETTINGS_CATEGORIES.flatMap((c) => c.rows.map((r) => r.key));
    expect(keys).not.toContain('contentsPlacement');
    expect(keys.filter((k) => k.startsWith('presentation-'))).toEqual([]);
  });

  it('adds, copies, removes, splits, sizes and turns no page, and offers no page kind', () => {
    const tab: Tab = {
      id: 't',
      name: 'Start Here',
      elements: [],
      ...newKnowledgebasePageContent(),
    };
    let commits = 0;
    const edits = pageEdits({
      tabId: tab.id,
      tab,
      current: pagesOf(tab),
      elements: tab.elements,
      commitTabs: () => {
        commits += 1;
      },
      onGoTo: () => {},
    } as unknown as Parameters<typeof pageEdits>[0]);
    expect(edits.addPage).toBeUndefined();
    expect(edits.addPageLike).toBeUndefined();
    expect(edits.duplicatePage).toBeUndefined();
    expect(edits.removePage).toBeUndefined();
    const pageId = pagesOf(tab)[0]!.id;
    edits.choosePageKind(pageId, 'slide');
    edits.setSize(pageId, 'a3');
    edits.setOrientation(pageId, 'landscape');
    edits.splitPage(pageId);
    expect(commits).toBe(0);
  });
});
