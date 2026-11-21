'use client';

// livedocuments' Automations kit (docs/specs/013-workspace/automations.md "The screen"; blueprint automations.md
// "Editor", "The kit"): the platform's item kit over this app's kinds registry, with the pictures and panels of its
// own triggers and steps, its templates, its snapshots and Add a Tab's templates, Describe a Rule's examples and the
// help link. Built ONCE, here at module level: only the lazy screen imports this module (DocumentAutomationsScreen),
// so none of it is in the editor's first load (document-automations-lazy.test.ts).

import {
  DOCUMENT_TEMPLATES,
  KINDS,
  TEMPLATE_CATEGORIES,
} from '@livedocuments/document/automations';
import { automationTabTemplates } from '@livedocuments/templates';
import { WEBHOOK_SIGNATURE_HEADER } from '@liveworkspace/automations';
import type { ComponentType } from 'react';
import {
  TabTriggerPanel,
  defineItemAutomationsKit,
  type ItemOwnAction,
} from '@liveworkspace/automations-ui/item';
import { snapshotsApi } from '@liveworkspace/snapshots/client';
import { useAuthHrefs } from '@liveworkspace/workbench/components/chrome/auth-routes';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { API_BASE, apiFetch, apiHeaders } from '@/lib/api/core';
import { useDocumentItem } from './document-item';
import { DOCUMENT_AUTOMATIONS_PLUMBING } from './document-plumbing';
import {
  DOCUMENT_ACTION_GLYPHS,
  DOCUMENT_ACTION_SCENES,
  DOCUMENT_TRIGGER_SCENES,
} from './document-scenes';
import { NameVersionPanel, RestoreVersionPanel } from './version-panels';

// A step's own panel, typed for its step, as the kit holds every panel: over any part (the kit hands each panel only
// its own kind's step).
const asPanel = <Props,>(panel: ComponentType<Props>) =>
  panel as unknown as NonNullable<ItemOwnAction['Panel']>;

// Describe a Rule's chips and its box's placeholder: what people ask of a document.
export const DESCRIBE_EXAMPLES: readonly { label: string; text: string }[] = [
  {
    label: 'Friday Version',
    text: 'Every Friday at 5, name a version and email me',
  },
  { label: 'Comments to Slack', text: 'Tell Slack when someone comments' },
  { label: 'Reset a Form Letter', text: 'Restore my form letter every night' },
];
export const DESCRIBE_PLACEHOLDER = 'Every Friday at 5, name a version and email me';

// The document's snapshots, newest first, read as this person. The screen opens only for a signed-in account, whose
// token apiHeaders sends; the owner id there only guards a guest's requests, so none is named.
const snapshots = async (item: { id: string; shareCode: string | null }) =>
  (
    await snapshotsApi({
      apiFetch: (input, init) => apiFetch(input, init),
      apiHeaders: (opts) => apiHeaders('', { share: item.shareCode, body: opts.body }),
      itemUrl: `${API_BASE}/documents/${encodeURIComponent(item.id)}`,
    }).list()
  ).snapshots;

export const DOCUMENT_AUTOMATIONS_KIT = defineItemAutomationsKit({
  kinds: KINDS,
  app: 'livedocuments',
  plumbing: DOCUMENT_AUTOMATIONS_PLUMBING,
  useItem: useDocumentItem,
  snapshots,
  tabTemplates: automationTabTemplates(),
  own: {
    // Any tab, or one.
    triggers: {
      version_named: { scene: DOCUMENT_TRIGGER_SCENES['version_named']!, Panel: TabTriggerPanel },
      version_restored: {
        scene: DOCUMENT_TRIGGER_SCENES['version_restored']!,
        Panel: TabTriggerPanel,
      },
      agent_changed: { scene: DOCUMENT_TRIGGER_SCENES['agent_changed']!, Panel: TabTriggerPanel },
    },
    actions: {
      name_version: {
        scene: DOCUMENT_ACTION_SCENES['name_version']!,
        glyph: DOCUMENT_ACTION_GLYPHS['name_version']!,
        Panel: asPanel(NameVersionPanel),
      },
      restore_version: {
        scene: DOCUMENT_ACTION_SCENES['restore_version']!,
        glyph: DOCUMENT_ACTION_GLYPHS['restore_version']!,
        Panel: asPanel(RestoreVersionPanel),
      },
    },
    tones: { Versions: 'orange' },
  },
  templates: { list: DOCUMENT_TEMPLATES, categories: TEMPLATE_CATEGORIES },
  describe: { examples: DESCRIBE_EXAMPLES, placeholder: DESCRIBE_PLACEHOLDER },
  helpButton: <HelpArticleLink article="automations" variant="button" label="How Rules Work" />,
  indexClient,
  useSignInHref: () => useAuthHrefs().signInHref,
  signatureHeader: WEBHOOK_SIGNATURE_HEADER,
});
