// Which of a template's free texts are sample copy (docs/specs/006-document/template-examples.md "What is example
// content"): the rule each template lands with, so Clear Example Content empties those texts too. Body copy and sample
// sentences are (isSampleCopy: plain words at a body size, two or more of them), on every template; titles, headings,
// single words and figures stay.
import { isSampleCopy, type ExampleTextRule } from '@liveknowledge/document';
import type { TemplateKind } from './templates';

/** The rule naming a template's sample copy among its free texts, for markTemplateExamples. */
export function templateExampleText(_kind: TemplateKind): ExampleTextRule {
  return isSampleCopy;
}
