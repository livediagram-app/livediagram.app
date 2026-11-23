// The Add an Action picker's groups (docs/specs/026-plan/automations.md "The rule builder"): every kind + Add Action
// offers, grouped (each group one thing, never two joined by "and"), each with a line on what it does.

import type { AddKind } from './step-defaults';

export type ActionGroupId =
  | 'cards'
  | 'create'
  | 'archive'
  | 'labels'
  | 'flags'
  | 'checklists'
  | 'links'
  | 'people'
  | 'comments'
  | 'timing'
  | 'tools'
  | 'ai';

export const ACTION_GROUPS: readonly {
  id: ActionGroupId;
  name: string;
  kinds: readonly AddKind[];
}[] = [
  {
    id: 'cards',
    name: 'Cards',
    kinds: ['move', 'set_field', 'clear_field', 'set_type', 'set_colour'],
  },
  { id: 'create', name: 'New Cards', kinds: ['create_card', 'copy_card'] },
  { id: 'archive', name: 'Archive', kinds: ['archive', 'restore'] },
  { id: 'labels', name: 'Labels', kinds: ['add_label', 'remove_label'] },
  { id: 'flags', name: 'Flags', kinds: ['flag', 'unflag'] },
  { id: 'checklists', name: 'Checklists', kinds: ['add_checklist'] },
  { id: 'links', name: 'Links', kinds: ['link_card'] },
  { id: 'people', name: 'People', kinds: ['assign', 'mention', 'email'] },
  { id: 'comments', name: 'Comments', kinds: ['comment', 'resolve_threads'] },
  { id: 'timing', name: 'Timing', kinds: ['wait'] },
  { id: 'tools', name: 'Other Tools', kinds: ['notify_webhook', 'notify_slack', 'notify_teams'] },
  { id: 'ai', name: 'AI', kinds: ['ai_summarise', 'ai_card_type', 'ai_triage'] },
];

export const ACTION_LINES: Readonly<Record<AddKind, string>> = {
  move: 'Move the card to one of its columns.',
  set_field: 'Set a field to a value, a value from the card, or a date.',
  clear_field: 'Empty one of the card’s fields.',
  archive: 'Archive the card.',
  create_card: 'Add a new card, copying from this one and linking to it if you like.',
  add_label: 'Put one of the plan’s labels on the card.',
  remove_label: 'Take a label off the card.',
  flag: 'Flag the card for attention.',
  unflag: 'Take the card’s flag off.',
  assign: 'Assign a person, whoever triggered it, or people in turn.',
  email: 'Email the assignee, a chosen person or typed-in addresses, with a link to the card.',
  comment: 'Start a thread on the card, written by Automation.',
  notify_webhook: 'Send a signed event to your own service.',
  notify_slack: 'Post a message with a link to a Slack channel.',
  notify_teams: 'Post a message with a link to a Microsoft Teams channel.',
  ai_summarise: 'Write a short summary to a comment or a text field.',
  ai_card_type: 'Pick the card type from what the card says.',
  ai_triage: 'Set the priority and up to 3 labels from what the card says.',
  set_type: 'Turn the card into another card type.',
  set_colour: 'Give the card a colour, or take its colour off.',
  restore: 'Bring an archived card back to its board.',
  copy_card: 'Add a copy of the card, in its column or another.',
  add_checklist: 'Add checklist items, skipping any the card already has.',
  link_card: 'Point a Card field, Blocked By too, at another card.',
  mention: '@mention someone in a thread, reaching their Inbox and email.',
  resolve_threads: 'Resolve every open comment thread on the card.',
  wait: 'Hold the rest of the rule for an hour up to 30 days.',
};
