import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@livediagram/templates';
import { STORY_CLASSES } from './motion';
import { TemplatePreview } from './template-preview';

// The hover stories (preview-motion.css) draw extra shapes into a preview:
// the ideas a mind map grows, the card that lands on a kanban, the flowchart's
// token. Those shapes are in the markup at rest, and the editor's picker
// renders the same markup without the motion stylesheet, so each one must be
// invisible until its story adds it.

const markup = TEMPLATES.map((t) => ({
  kind: t.kind,
  svg: renderToStaticMarkup(createElement(TemplatePreview, { kind: t.kind })),
}));

const STORY_ENTRANCES = ['pv-new', 'pv-arrive', 'pv-token'];

describe('preview hover stories', () => {
  it('keeps every shape a story adds invisible at rest', () => {
    for (const { kind, svg } of markup) {
      for (const tag of svg.match(/<[a-z]+ [^>]*class="[^"]*"[^>]*>/g) ?? []) {
        const classes = /class="([^"]*)"/.exec(tag)![1]!.split(' ');
        if (!classes.some((c) => STORY_ENTRANCES.includes(c))) continue;
        expect(tag, `${kind}: ${tag}`).toContain('opacity="0"');
      }
    }
  });

  it('uses only story classes the stylesheet defines', () => {
    for (const { kind, svg } of markup) {
      for (const [, list] of svg.matchAll(/class="([^"]*)"/g)) {
        for (const c of list!.split(' ').filter((c) => c.startsWith('pv-'))) {
          expect(STORY_CLASSES, `${kind} uses ${c}`).toContain(c);
        }
      }
    }
  });

  it('tells a story on the flagship templates', () => {
    const storied = markup.filter(({ svg }) => /class="pv-/.test(svg)).map((m) => m.kind);
    expect(storied).toEqual(
      expect.arrayContaining([
        'mindmap',
        'mindmap-tree',
        'mindmap-bubble',
        'kanban',
        'flowchart',
        'gantt',
      ]),
    );
  });
});
