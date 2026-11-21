'use client';

// liveknowledge's Automations kit (docs/specs/013-workspace/automations.md "The screen"; blueprint automations.md
// "Editor", "The kit"): the platform's item kit over this app's kinds registry, with the pictures and panels of its
// own triggers and steps, its templates, its snapshots and Add a Page's templates, Describe a Rule's examples and the
// help link. Built ONCE, here at module level: only the lazy screen imports this module (DocumentAutomationsScreen),
// so none of it is in the editor's first load (document-automations-lazy.test.ts).

import {
  DOCUMENT_TEMPLATES,
  KINDS,
  TEMPLATE_CATEGORIES,
} from '@liveknowledge/document/automations';
import { automationTabTemplates } from '@liveknowledge/templates';
import { WEBHOOK_SIGNATURE_HEADER } from '@liveworkspace/automations';
import type { ComponentType } from 'react';
import {
  TabTriggerPanel,
  defineItemAutomationsKit,
  type ItemOwnAction,
  type ItemVignette,
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
import {
  KNOWLEDGE_ACTION_GLYPHS,
  KNOWLEDGE_ACTION_SCENES,
  KNOWLEDGE_TRIGGER_SCENES,
} from './knowledge-scenes';
import {
  ClearVerificationPanel,
  ContextPanel,
  EmailOwnerPanel,
  SetOwnerPanel,
} from './knowledge-panels';
import { NameVersionPanel, RestoreVersionPanel } from './version-panels';

// A step's own panel, typed for its step, as the kit holds every panel: over any part (the kit hands each panel only
// its own kind's step).
const asPanel = <Props,>(panel: ComponentType<Props>) =>
  panel as unknown as NonNullable<ItemOwnAction['Panel']>;

// Describe a Rule's chips and its box's placeholder: what people ask of a knowledgebase.
export const DESCRIBE_EXAMPLES: readonly { label: string; text: string }[] = [
  { label: 'Reviews to Slack', text: 'Tell Slack when a page is due for review' },
  { label: 'Agent Edits', text: 'Email the owner when an agent changes their page' },
  { label: 'Unanswered Questions', text: 'Post unanswered questions to Slack' },
];
export const DESCRIBE_PLACEHOLDER = 'Tell Slack when a page is due for review';

// A trigger kept to any page or one, with its picture.
const pageTrigger = (scene: ItemVignette) => ({ scene, Panel: TabTriggerPanel });

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
  app: 'liveknowledge',
  plumbing: DOCUMENT_AUTOMATIONS_PLUMBING,
  useItem: useDocumentItem,
  snapshots,
  tabTemplates: automationTabTemplates(),
  own: {
    // Any page, or one; Unanswered Question has nothing to set.
    triggers: {
      page_verified: pageTrigger(KNOWLEDGE_TRIGGER_SCENES['page_verified']!),
      review_due: pageTrigger(KNOWLEDGE_TRIGGER_SCENES['review_due']!),
      owner_changed: pageTrigger(KNOWLEDGE_TRIGGER_SCENES['owner_changed']!),
      question_unanswered: { scene: KNOWLEDGE_TRIGGER_SCENES['question_unanswered']! },
      pages_disagree: pageTrigger(KNOWLEDGE_TRIGGER_SCENES['pages_disagree']!),
      suggestion_added: pageTrigger(KNOWLEDGE_TRIGGER_SCENES['suggestion_added']!),
      agent_changed: pageTrigger(DOCUMENT_TRIGGER_SCENES['agent_changed']!),
      version_named: pageTrigger(DOCUMENT_TRIGGER_SCENES['version_named']!),
      version_restored: pageTrigger(DOCUMENT_TRIGGER_SCENES['version_restored']!),
    },
    actions: {
      set_owner: {
        scene: KNOWLEDGE_ACTION_SCENES['set_owner']!,
        glyph: KNOWLEDGE_ACTION_GLYPHS['set_owner']!,
        Panel: asPanel(SetOwnerPanel),
      },
      clear_verification: {
        scene: KNOWLEDGE_ACTION_SCENES['clear_verification']!,
        glyph: KNOWLEDGE_ACTION_GLYPHS['clear_verification']!,
        Panel: asPanel(ClearVerificationPanel),
      },
      email_owner: {
        scene: KNOWLEDGE_ACTION_SCENES['email_owner']!,
        glyph: KNOWLEDGE_ACTION_GLYPHS['email_owner']!,
        Panel: asPanel(EmailOwnerPanel),
      },
      context: {
        scene: KNOWLEDGE_ACTION_SCENES['context']!,
        glyph: KNOWLEDGE_ACTION_GLYPHS['context']!,
        Panel: asPanel(ContextPanel),
      },
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
    tones: { Trust: 'emerald', 'AI Knowledge': 'violet', Versions: 'orange' },
  },
  templates: { list: DOCUMENT_TEMPLATES, categories: TEMPLATE_CATEGORIES },
  describe: { examples: DESCRIBE_EXAMPLES, placeholder: DESCRIBE_PLACEHOLDER },
  helpButton: <HelpArticleLink article="automations" variant="button" label="How Rules Work" />,
  indexClient,
  useSignInHref: () => useAuthHrefs().signInHref,
  signatureHeader: WEBHOOK_SIGNATURE_HEADER,
});
