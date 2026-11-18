// Which of a template's free texts are sample copy (docs/specs/006-design/template-examples.md "What is example
// content"): the rule each template lands with, so Clear Example Content empties those texts too. Body copy and sample
// sentences are (isSampleCopy: plain words at a body size, two or more of them); titles, headings, single words and
// figures stay. A logo template's words are the mark itself, so none of them is.
import { isSampleCopy, type ExampleTextRule } from '@livedesign/design';
import type { TemplateKind } from './templates';

const NONE: ExampleTextRule = () => false;

const LOGO_KINDS: ReadonlySet<TemplateKind> = new Set<TemplateKind>([
  'logo-design',
  'logo-lockups',
  'logo-wordmarks',
  'logo-emblems',
  'logo-marks',
]);

/** The rule naming a template's sample copy among its free texts, for markTemplateExamples. */
export function templateExampleText(kind: TemplateKind): ExampleTextRule {
  return LOGO_KINDS.has(kind) ? NONE : isSampleCopy;
}
