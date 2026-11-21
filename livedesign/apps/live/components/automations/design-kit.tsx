'use client';

// livedesign's Automations kit (docs/specs/013-workspace/automations.md "The screen"; blueprint automations.md
// "Editor", "The kit"): the platform's item kit over this app's kinds registry, with the pictures and panels of its
// own triggers, its templates, its snapshots and Add a Tab's templates, Describe a Rule's examples and the help link.
// Built ONCE, here at module level: only the lazy screen imports this module (DesignAutomationsScreen), so none of it
// is in the editor's first load (design-automations-lazy.test.ts).

import {
  COMPONENT_CHANGED_EVENT,
  DESIGN_TEMPLATES,
  KINDS,
  TEMPLATE_CATEGORIES,
} from '@livedesign/design/automations';
import { automationTabTemplates } from '@livedesign/templates';
import { WEBHOOK_SIGNATURE_HEADER } from '@liveworkspace/automations';
import { AGENT_CHANGED_EVENT } from '@liveworkspace/automations/item';
import type { ComponentType } from 'react';
import {
  TabTriggerPanel,
  defineItemAutomationsKit,
  type ItemOwnTrigger,
} from '@liveworkspace/automations-ui/item';
import { snapshotsApi } from '@liveworkspace/snapshots/client';
import { useAuthHrefs } from '@liveworkspace/workbench/components/chrome/auth-routes';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { API_BASE, apiFetch, apiHeaders } from '@/lib/api/core';
import { ComponentChangedPanel } from './component-panel';
import { useDesignItem } from './design-item';
import { DESIGN_AUTOMATIONS_PLUMBING } from './design-plumbing';
import { DESIGN_TRIGGER_SCENES } from './design-scenes';

// A trigger's own panel, typed for its trigger, as the kit holds every panel: over any part (the kit hands each panel
// only its own kind's trigger).
const asPanel = <Props,>(panel: ComponentType<Props>) =>
  panel as unknown as NonNullable<ItemOwnTrigger['Panel']>;

// Describe a Rule's chips and its box's placeholder: what people ask of a design.
export const DESCRIBE_EXAMPLES: readonly { label: string; text: string }[] = [
  {
    label: 'Library to Slack',
    text: 'Tell Slack when a component in the library changes',
  },
  { label: 'Friday Snapshot', text: 'Every Friday at 5, take a snapshot and email me' },
  { label: 'Feedback to Slack', text: 'Post every new comment to Slack' },
];
export const DESCRIBE_PLACEHOLDER = 'Tell Slack when a component in the library changes';

// The design's snapshots, newest first, read as this person. The screen opens only for a signed-in account, whose
// token apiHeaders sends; the owner id there only guards a guest's requests, so none is named.
const snapshots = async (item: { id: string; shareCode: string | null }) =>
  (
    await snapshotsApi({
      apiFetch: (input, init) => apiFetch(input, init),
      apiHeaders: (opts) => apiHeaders('', { share: item.shareCode, body: opts.body }),
      itemUrl: `${API_BASE}/designs/${encodeURIComponent(item.id)}`,
    }).list()
  ).snapshots;

export const DESIGN_AUTOMATIONS_KIT = defineItemAutomationsKit({
  kinds: KINDS,
  app: 'livedesign',
  plumbing: DESIGN_AUTOMATIONS_PLUMBING,
  useItem: useDesignItem,
  snapshots,
  tabTemplates: automationTabTemplates(),
  own: {
    triggers: {
      // Any component, or one main of the library.
      [COMPONENT_CHANGED_EVENT]: {
        scene: DESIGN_TRIGGER_SCENES[COMPONENT_CHANGED_EVENT]!,
        Panel: asPanel(ComponentChangedPanel),
      },
      // Any tab, or one.
      [AGENT_CHANGED_EVENT]: {
        scene: DESIGN_TRIGGER_SCENES[AGENT_CHANGED_EVENT]!,
        Panel: TabTriggerPanel,
      },
    },
    tones: { Components: 'orange' },
  },
  templates: { list: DESIGN_TEMPLATES, categories: TEMPLATE_CATEGORIES },
  describe: { examples: DESCRIBE_EXAMPLES, placeholder: DESCRIBE_PLACEHOLDER },
  helpButton: <HelpArticleLink article="automations" variant="button" label="How Rules Work" />,
  indexClient,
  useSignInHref: () => useAuthHrefs().signInHref,
  signatureHeader: WEBHOOK_SIGNATURE_HEADER,
});
