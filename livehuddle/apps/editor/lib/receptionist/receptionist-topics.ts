// What the Receptionist can explain (docs/specs/008-canvas/receptionist.md "The topics"): fifteen topics in five groups, all in one
// list. Each answer is one idea, the control named as it is labelled, and rings that control
// (a CSS selector for the editor's chrome) or walks you into a room. Pure data and a filter: no React, no DOM.

export type ReceptionistTopicGroup = 'Talk' | 'Meet' | 'Move' | 'You' | 'Space';

export const RECEPTIONIST_TOPIC_GROUPS: readonly ReceptionistTopicGroup[] = [
  'Talk',
  'Meet',
  'Move',
  'You',
  'Space',
];

export type ReceptionistTopic = {
  id: string;
  group: ReceptionistTopicGroup;
  // The reply, as the person picks it.
  title: string;
  // The Receptionist's one line.
  answer: string;
  // What it rings while the answer shows: a selector, or 'room' (he walks you into the nearest room).
  target?: string;
  // Left out for someone who may not speak, or who may not edit.
  needs?: 'speak' | 'edit';
};

export const RECEPTIONIST_TOPICS: readonly ReceptionistTopic[] = [
  {
    id: 'talking',
    group: 'Talk',
    title: 'Talking to People',
    answer: 'Unmute down here. People close by hear you, and their voices fade as they walk away.',
    target: '[data-tour-id="call-button"] > :first-child',
  },
  {
    id: 'camera',
    group: 'Talk',
    title: 'Camera and Screen',
    answer:
      'Camera or Share shows in a bubble over your head, for the people who can hear you. Press a bubble to make it big.',
    target: '[data-tour-id="call-button"]',
  },
  {
    id: 'say',
    group: 'Talk',
    title: 'Say, Actions and React',
    answer:
      'Press Enter to say something over your head. Actions and React wave, dance or throw confetti.',
    target: '[data-tour-id="avatar-message"]',
    needs: 'speak',
  },
  {
    id: 'rooms',
    group: 'Meet',
    title: 'Rooms and Meetings',
    answer: 'Inside a room, only the people in it hear you. If its sign says In Use, knock first.',
    target: 'room',
  },
  {
    id: 'knocking',
    group: 'Meet',
    title: 'Knocking on a Room',
    answer: 'Walk up to a busy room and press Knock. The people inside choose Let In or Not Now.',
  },
  {
    id: 'stage',
    group: 'Meet',
    title: 'The Stage',
    answer:
      'Someone on a stage is heard by the whole hall. In the audience, Raise Hand asks to speak.',
  },
  {
    id: 'getting-around',
    group: 'Move',
    title: 'Getting Around',
    answer:
      'Arrow keys or a click on the floor walk you there. Space hops. The Map shows the whole floor.',
    target: '[data-tour-id="minimap"]',
  },
  {
    id: 'floors',
    group: 'Move',
    title: 'Floors, Lifts and Portals',
    answer:
      'Each tab is a floor. Walk into a lift to change floor, or into a linked portal to jump across.',
    target: '[data-region="tabs"]',
  },
  {
    id: 'following',
    group: 'Move',
    title: 'Following Someone',
    answer: 'Click a face by the tab, then Follow, and your view goes where theirs does.',
    target: '[data-tour-id="presence"]',
  },
  {
    id: 'look',
    group: 'You',
    title: 'Looking Like Me',
    answer: 'Gender, Clothes and Hair dress your character. Your shirt is always your colour.',
    target: '[data-tour-id="avatar-character"]',
  },
  {
    id: 'status',
    group: 'You',
    title: 'Status and Do Not Disturb',
    answer: 'Status tells people if you are free. Do Not Disturb stops voices reaching you.',
    target: '[data-tour-id="bar-status"]',
  },
  {
    id: 'seats',
    group: 'You',
    title: 'Seats and the Kitchen',
    answer:
      'Click a chair or sofa to sit. Walk up to the coffee machine or water cooler for a drink.',
  },
  {
    id: 'inviting',
    group: 'Space',
    title: 'Inviting My Team',
    answer: 'Share sends a link. Your team arrives on the pad, right where I greet them.',
    target: '[data-tour-id="share"]',
  },
  {
    id: 'building',
    group: 'Space',
    title: 'Building the Space',
    answer: 'Edit lets you add rooms, desks, plants and portals. Walk takes you back.',
    target: '[data-tour-id="edit-walk"]',
    needs: 'edit',
  },
  {
    id: 'help',
    group: 'Space',
    title: 'Tours and Help',
    answer: 'Ask me any time from the button down here. Settings › Getting Started brings my welcome back.',
    target: '[data-tour-offer="receptionist"]',
  },
];

/** The topics this person gets: none needing a voice they lack, or an edit they may not make. */
export function receptionistTopicsFor(can: { speak: boolean; edit: boolean }): ReceptionistTopic[] {
  return RECEPTIONIST_TOPICS.filter(
    (t) => (t.needs !== 'speak' || can.speak) && (t.needs !== 'edit' || can.edit),
  );
}

/** Topic ids heard, with `id` added once, in the order heard. */
export function withTopicHeard(heard: readonly string[] | undefined, id: string): string[] {
  const list = heard ?? [];
  return list.includes(id) ? [...list] : [...list, id];
}

/** The telemetry token for a topic's answer: 'getting-around' → 'ReceptionistTopicGettingAround'. */
export function receptionistTopicTelemetryType(id: string): string {
  return `ReceptionistTopic${id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')}`;
}
