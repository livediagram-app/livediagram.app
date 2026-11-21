'use client';

// livehuddle's Automations kit (docs/specs/013-workspace/automations.md "The screen"; blueprint automations.md
// "Editor", "The kit"): the platform's item kit over this app's kinds registry, with the pictures and panels of its
// own triggers and its step, its templates, its snapshots and Add a Tab's templates, Describe a Rule's examples and
// the help link. Built ONCE, here at module level: only the lazy screen imports this module (SpaceAutomationsScreen),
// so none of it is in the editor's first load (space-automations-lazy.test.ts).

import {
  CLEAR_SUGGESTIONS_STEP,
  EVERYONE_LEFT_TRIGGER,
  KINDS,
  SOMEONE_ARRIVED_EVENT,
  SPACE_TEMPLATES,
  SUGGESTION_DROPPED_EVENT,
  TEMPLATE_CATEGORIES,
} from '@livehuddle/document/automations';
import { automationTabTemplates } from '@livehuddle/templates';
import { WEBHOOK_SIGNATURE_HEADER } from '@liveworkspace/automations';
import type { ComponentType } from 'react';
import { defineItemAutomationsKit, type ItemOwnTrigger } from '@liveworkspace/automations-ui/item';
import { snapshotsApi } from '@liveworkspace/snapshots/client';
import { useAuthHrefs } from '@liveworkspace/workbench/components/chrome/auth-routes';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { API_BASE, apiFetch, apiHeaders } from '@/lib/api/core';
import { useSpaceItem } from './space-people';
import { SPACE_AUTOMATIONS_PLUMBING } from './space-plumbing';
import { SPACE_ACTION_GLYPHS, SPACE_ACTION_SCENES, SPACE_TRIGGER_SCENES } from './space-scenes';
import { EveryoneLeftPanel, SomeoneArrivedPanel } from './visit-panels';

// A trigger's own panel, typed for its trigger, as the kit holds every panel: over any part (the kit hands each panel
// only its own kind's trigger).
const asPanel = <Props,>(panel: ComponentType<Props>) =>
  panel as unknown as NonNullable<ItemOwnTrigger['Panel']>;

// Describe a Rule's chips and its box's placeholder: what people ask of a Space, the nightly reset first.
export const DESCRIBE_EXAMPLES: readonly { label: string; text: string }[] = [
  { label: 'Reset Every Night', text: 'Reset this Space to a snapshot every night' },
  { label: 'Tidy Up After', text: 'When everyone leaves a room, put it back as it was' },
  { label: 'Office Is Open', text: 'Tell Slack when someone arrives in an empty room' },
];
export const DESCRIBE_PLACEHOLDER = 'Reset this Space to a snapshot every night';

// The Space's snapshots, newest first, read as this person. The screen opens only for a signed-in account, whose
// token apiHeaders sends; the owner id there only guards a guest's requests, so none is named.
const snapshots = async (item: { id: string; shareCode: string | null }) =>
  (
    await snapshotsApi({
      apiFetch: (input, init) => apiFetch(input, init),
      apiHeaders: (opts) => apiHeaders('', { share: item.shareCode, body: opts.body }),
      itemUrl: `${API_BASE}/documents/${encodeURIComponent(item.id)}`,
    }).list()
  ).snapshots;

export const SPACE_AUTOMATIONS_KIT = defineItemAutomationsKit({
  kinds: KINDS,
  app: 'livehuddle',
  plumbing: SPACE_AUTOMATIONS_PLUMBING,
  useItem: useSpaceItem,
  snapshots,
  tabTemplates: automationTabTemplates(),
  own: {
    triggers: {
      // Any room, or one; only the first one in unless told otherwise.
      [SOMEONE_ARRIVED_EVENT]: {
        scene: SPACE_TRIGGER_SCENES[SOMEONE_ARRIVED_EVENT]!,
        Panel: asPanel(SomeoneArrivedPanel),
      },
      // How long the room stays empty, and which room.
      [EVERYONE_LEFT_TRIGGER]: {
        scene: SPACE_TRIGGER_SCENES[EVERYONE_LEFT_TRIGGER]!,
        Panel: asPanel(EveryoneLeftPanel),
      },
      // Nothing to set: its panel says when it starts.
      [SUGGESTION_DROPPED_EVENT]: { scene: SPACE_TRIGGER_SCENES[SUGGESTION_DROPPED_EVENT]! },
    },
    actions: {
      // Nothing to set: its panel says what it does.
      [CLEAR_SUGGESTIONS_STEP]: {
        scene: SPACE_ACTION_SCENES[CLEAR_SUGGESTIONS_STEP]!,
        glyph: SPACE_ACTION_GLYPHS[CLEAR_SUGGESTIONS_STEP]!,
      },
    },
    tones: { Space: 'orange' },
  },
  templates: { list: SPACE_TEMPLATES, categories: TEMPLATE_CATEGORIES },
  describe: { examples: DESCRIBE_EXAMPLES, placeholder: DESCRIBE_PLACEHOLDER },
  helpButton: <HelpArticleLink article="automations" variant="button" label="How Rules Work" />,
  indexClient,
  useSignInHref: () => useAuthHrefs().signInHref,
  signatureHeader: WEBHOOK_SIGNATURE_HEADER,
});
