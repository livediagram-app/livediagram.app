// The template family each template belongs to (docs/specs/013-workspace/default-folders.md
// "Entries"): the one map that routes a new space made from a family to its
// default folder. A family is a set of ordinary templates; none has one today.
// A Record over TemplateKind, so a new template kind does not compile until it is mapped.

import type { TemplateFamilyOrNone } from '@livehuddle/api-schema';
import type { TemplateKind } from './templates';

const TEMPLATE_FAMILY: Record<TemplateKind, TemplateFamilyOrNone> = {
  'blank-session': null,
  'virtual-office': null,
  'coworking-space': null,
  'team-pod': null,
  'all-hands-hall': null,
  'focus-library': null,
  'training-room': null,
  'rooftop-bar': null,
  cafe: null,
  'garden-retreat': null,
  'city-park': null,
  'company-campus': null,
  'conference-venue': null,
  'startup-hq': null,
  'school-quad': null,
  'hotel-and-suites': null,
  'coworking-tower': null,
  'expo-hall': null,
  'beach-offsite': null,
};

/** The family a document made from this template belongs to; null for no template or no family. */
export function templateFamilyOf(kind: TemplateKind | null): TemplateFamilyOrNone {
  return kind === null ? null : TEMPLATE_FAMILY[kind];
}
