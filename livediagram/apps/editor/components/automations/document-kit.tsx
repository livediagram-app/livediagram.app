'use client';

// livediagram's Automations kit (docs/specs/013-workspace/automations.md "The screen"; blueprint automations.md
// "Editor", "The kit"): the platform's item kit over this app's kinds registry, with the pictures of its own
// triggers, its templates, its snapshots and Add a Tab's templates, Describe a Rule's examples and the help link.
// Built ONCE, here at module level: only the lazy screen imports this module (DocumentAutomationsScreen), so none of
// it is in the editor's first load (document-automations-lazy.test.ts).

import { DOCUMENT_TEMPLATES, KINDS, TEMPLATE_CATEGORIES } from '@livediagram/document/automations';
import { automationTabTemplates } from '@livediagram/templates';
import { WEBHOOK_SIGNATURE_HEADER } from '@liveworkspace/automations';
import { TabTriggerPanel, defineItemAutomationsKit } from '@liveworkspace/automations-ui/item';
import { snapshotsApi } from '@liveworkspace/snapshots/client';
import { useAuthHrefs } from '@liveworkspace/workbench/components/chrome/auth-routes';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { API_BASE, apiFetch, apiHeaders } from '@/lib/api/core';
import { useDocumentItem } from './document-item';
import { DOCUMENT_AUTOMATIONS_PLUMBING } from './document-plumbing';
import { DOCUMENT_TRIGGER_SCENES } from './document-scenes';

// Describe a Rule's chips and its box's placeholder: what people ask of a canvas.
export const DESCRIBE_EXAMPLES: readonly { label: string; text: string }[] = [
  {
    label: 'Friday Snapshot',
    text: 'Every Friday at 5, take a snapshot and email me',
  },
  { label: 'Reset Nightly', text: 'Reset this board every night' },
  { label: 'Comments to Slack', text: 'Tell Slack when someone comments' },
];
export const DESCRIBE_PLACEHOLDER = 'Every Friday at 5, take a snapshot and email me';

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
  app: 'livediagram',
  plumbing: DOCUMENT_AUTOMATIONS_PLUMBING,
  useItem: useDocumentItem,
  snapshots,
  tabTemplates: automationTabTemplates(),
  own: {
    triggers: {
      // Nothing to set: its panel says when it starts.
      poll_ended: { scene: DOCUMENT_TRIGGER_SCENES['poll_ended']! },
      // Any tab, or one.
      question_asked: { scene: DOCUMENT_TRIGGER_SCENES['question_asked']!, Panel: TabTriggerPanel },
      agent_changed: { scene: DOCUMENT_TRIGGER_SCENES['agent_changed']!, Panel: TabTriggerPanel },
    },
    tones: { Workshop: 'orange' },
  },
  templates: { list: DOCUMENT_TEMPLATES, categories: TEMPLATE_CATEGORIES },
  describe: { examples: DESCRIBE_EXAMPLES, placeholder: DESCRIBE_PLACEHOLDER },
  helpButton: <HelpArticleLink article="automations" variant="button" label="How Rules Work" />,
  indexClient,
  useSignInHref: () => useAuthHrefs().signInHref,
  signatureHeader: WEBHOOK_SIGNATURE_HEADER,
});
