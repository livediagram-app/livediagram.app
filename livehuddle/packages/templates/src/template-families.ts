// The template family each template belongs to (docs/specs/013-workspace/default-folders.md
// "Creation intent"): the one map that routes a new retrospective to its default
// folder. A family is a set of ordinary diagram templates. A Record over
// TemplateKind, so a new template kind does not compile until it is mapped.

import type { TemplateFamily } from '@livehuddle/api-schema';
import type { TemplateKind } from './templates';

const TEMPLATE_FAMILY: Record<TemplateKind, TemplateFamily | null> = {
  'blank-session': null,
  'virtual-office': null,
  'coworking-space': null,
  'team-pod': null,
  'all-hands-hall': null,
};

/** The family a document made from this template belongs to; null for no template or no family. */
export function templateFamilyOf(kind: TemplateKind | null): TemplateFamily | null {
  return kind === null ? null : TEMPLATE_FAMILY[kind];
}
