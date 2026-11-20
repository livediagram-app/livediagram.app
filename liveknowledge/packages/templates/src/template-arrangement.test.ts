import { describe, expect, it } from 'vitest';
import { tabStacksPages } from '@liveknowledge/document';
import { templateCanvasOverrides } from './template-canvas-overrides';
import { STACKED_TEMPLATES, templateArrangement } from './template-arrangement';
import { TEMPLATES } from './templates';

// docs/specs/008-canvas/canvas-and-palette.md "What a template shows off": Stack Pages where a sequence is the point.
describe('how a template stands', () => {
  it('stacks the Social Carousel and the Group Card, and nothing else', () => {
    expect([...STACKED_TEMPLATES].sort()).toEqual(['live-card', 'social-carousel']);
    for (const { kind } of TEMPLATES) {
      const o = templateCanvasOverrides(kind);
      expect(o.pageArrangement, kind).toBe(STACKED_TEMPLATES.has(kind) ? 'stack' : undefined);
      expect(templateArrangement(kind), kind).toEqual(
        STACKED_TEMPLATES.has(kind) ? { pageArrangement: 'stack' } : {},
      );
    }
  });

  it('lands the stacked templates as a stack, the flashcards by their kind, a deck and an article in a row', () => {
    const stands = (kind: (typeof TEMPLATES)[number]['kind']) => {
      const o = templateCanvasOverrides(kind);
      return tabStacksPages(o.pages ?? [], o.pageArrangement);
    };
    expect(stands('social-carousel')).toBe(true);
    expect(stands('live-card')).toBe(true);
    expect(stands('talk-flashcards')).toBe(true);
    expect(stands('launch-keynote')).toBe(false);
    expect(stands('year-in-review')).toBe(false);
    expect(stands('research-report')).toBe(false);
  });
});
