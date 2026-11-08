import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { ALL_TOPIC_CARDS, CURRICULUM } from '../curriculum';
import { topicMs, type Topic } from '../topic';
import { OPENABLES } from '@/components/tour/replay-dom';
import { TOPICS } from '.';

// What every Watch It Built topic holds (docs/specs/007-editor/watch-it-built.md "The curriculum"): its card and its
// replay agree, its chapter ids are unique across the curriculum (the dashboard reads them as `TourStep<Id>`), its
// words are touch-aware and dash-free, its frames are pure and draw only what the player can open, and Example's moves
// sit inside their chapter in time order.

const tab = {
  id: 't',
  name: 'Tab',
  elements: [],
  backgroundColor: '#ffffff',
} as unknown as Tab;
const env = { centre: { x: 400, y: 300 }, size: { width: 1440, height: 820 }, tab };
const phone = { ...env, size: { width: 390, height: 700 } };

describe.each(ALL_TOPIC_CARDS.map((c) => [c.id, c] as const))('%s', (id, card) => {
  const topic = TOPICS[id] as Topic;

  it('has a replay, two to four chapters, and a card that rounds its length', () => {
    expect(topic).toBeDefined();
    expect(topic.chapters.length).toBeGreaterThanOrEqual(2);
    expect(topic.chapters.length).toBeLessThanOrEqual(4);
    expect(Math.abs(card.seconds * 1000 - topicMs(topic))).toBeLessThanOrEqual(2500);
    expect(CURRICULUM[card.mode]).toContain(card);
  });

  it('words every line for touch too, in Title Case names, never with an em dash', () => {
    for (const c of topic.chapters) {
      expect(`${c.say} ${c.sayTouch} ${c.name} ${c.shortName}`).not.toMatch(/—/);
      expect(c.shortName.length).toBeLessThanOrEqual(c.name.length);
      expect(c.name[0]).toBe(c.name[0]!.toUpperCase());
    }
    expect(`${card.title} ${card.line}`).not.toMatch(/—/);
  });

  it.each([
    ['desktop', env],
    ['phone', phone],
  ])(
    'draws the same frame for the same moment on a %s, opening only what the player can open',
    (_on, at) => {
      const layout = topic.layout(at);
      topic.chapters.forEach((chapter, i) => {
        for (let ms = 0; ms <= chapter.ms; ms += 250) {
          const frame = topic.frame(i, ms, layout);
          expect(topic.frame(i, ms, layout)).toEqual(frame);
          for (const o of frame.open ?? []) expect(Object.keys(OPENABLES)).toContain(o);
          const ids = frame.elements.map((e) => e.id);
          expect(new Set(ids).size).toBe(ids.length);
          if (frame.selectedId) expect(ids).toContain(frame.selectedId);
          if (frame.menu) expect(ids).toContain(frame.menu.on);
        }
      });
    },
  );

  it('moves Example inside each chapter, in time order', () => {
    const layout = topic.layout(env);
    topic.chapters.forEach((chapter, i) => {
      const times = topic.plan(i, layout).map((w) => w.at);
      expect(times.length).toBeGreaterThan(0);
      expect([...times].sort((x, y) => x - y)).toEqual(times);
      expect(Math.max(...times)).toBeLessThan(chapter.ms);
    });
  });
});

describe('the curriculum', () => {
  it('has unique topic ids and chapter ids across every mode', () => {
    const ids = ALL_TOPIC_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const chapters = ALL_TOPIC_CARDS.flatMap((c) => TOPICS[c.id]!.chapters.map((ch) => ch.id));
    expect(new Set(chapters).size).toBe(chapters.length);
    const telemetry = ALL_TOPIC_CARDS.map((c) => c.telemetry);
    expect(new Set(telemetry).size).toBe(telemetry.length);
  });

  it('has a replay for every card and a card for every replay', () => {
    expect(Object.keys(TOPICS).sort()).toEqual(ALL_TOPIC_CARDS.map((c) => c.id).sort());
  });
});
