// Which of a template's free texts are sample copy (docs/specs/006-document/template-examples.md "What is example
// content"): the rule each template lands with, so Clear Example Content empties those texts too. A board's free
// text is mostly how to read it (the guide line, prompts, keys and legends, column titles), so here a template opts
// its sample copy in by its words, the builder's own data; a template not named here has none.
import { sampleCopyNamed, type ExampleTextRule } from '@livediagram/document';
import { FISHBONE_SAMPLE_COPY } from './template-builders-fishbone';
import { ROADMAP_SAMPLE_COPY } from './template-builders-roadmap';
import { TIMELINE_SAMPLE_COPY } from './template-builders-timelines';
import { VENN_SAMPLE_COPY } from './template-builders-venn';
import type { TemplateKind } from './templates';

const NONE: ExampleTextRule = () => false;

const RULES: Partial<Record<TemplateKind, ExampleTextRule>> = {
  fishbone: sampleCopyNamed(FISHBONE_SAMPLE_COPY),
  roadmap: sampleCopyNamed(ROADMAP_SAMPLE_COPY),
  timeline: sampleCopyNamed(TIMELINE_SAMPLE_COPY),
  venn: sampleCopyNamed(VENN_SAMPLE_COPY),
};

/** The rule naming a template's sample copy among its free texts, for markTemplateExamples. */
export function templateExampleText(kind: TemplateKind): ExampleTextRule {
  return RULES[kind] ?? NONE;
}
