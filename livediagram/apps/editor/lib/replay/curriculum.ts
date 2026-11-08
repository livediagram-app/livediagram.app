import type { ReplayMode } from './topic';

// Watch It Built's curriculum as the start panel and Settings see it (docs/specs/007-editor/watch-it-built.md "The
// curriculum"): each mode's topics, in order, by name and line only. The replays themselves (lib/replay/topics) load
// with the player when one is picked, so the editor's first load carries only this list.

export type TopicCard = {
  readonly id: string;
  readonly mode: ReplayMode;
  readonly title: string;
  // One line on what it shows.
  readonly line: string;
  // `UI·View·WatchTopic<telemetry>` when it is picked.
  readonly telemetry: string;
  // About how long it runs, rounded to 5 s (a test holds it to the replay's chapters).
  readonly seconds: number;
};

export const CURRICULUM: Record<ReplayMode, readonly TopicCard[]> = {
  diagram: [
    {
      id: 'diagram-basics',
      mode: 'diagram',
      title: 'The Basics',
      line: 'Add shapes, join them, name them and colour one.',
      telemetry: 'Basics',
      seconds: 25,
    },
    {
      id: 'diagram-look',
      mode: 'diagram',
      title: 'Look and Feel',
      line: 'Give the whole tab a new look and background.',
      telemetry: 'Look',
      seconds: 20,
    },
    {
      id: 'diagram-shape',
      mode: 'diagram',
      title: 'Style a Shape',
      line: 'Border, shadow and font for one shape.',
      telemetry: 'Shape',
      seconds: 20,
    },
    {
      id: 'diagram-find',
      mode: 'diagram',
      title: 'Find Anything',
      line: 'Search every shape by name or use, and drop it in.',
      telemetry: 'Find',
      seconds: 15,
    },
    {
      id: 'diagram-tidy',
      mode: 'diagram',
      title: 'Tidy Up',
      line: 'Lay a messy flow out neatly in one press.',
      telemetry: 'Tidy',
      seconds: 10,
    },
  ],
  draw: [],
  workshop: [],
};

export const ALL_TOPIC_CARDS: readonly TopicCard[] = [
  ...CURRICULUM.diagram,
  ...CURRICULUM.draw,
  ...CURRICULUM.workshop,
];

export const topicCard = (id: string) => ALL_TOPIC_CARDS.find((t) => t.id === id);
