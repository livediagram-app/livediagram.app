// Send to Plan's pure pieces (liveworkspace/docs/specs/004-index/send-to-plan.md): the cards a send makes, the places
// a menu asks for and who may ask, with the clock pinned to one local day.
import { planSendRef, type PlanSend, type PlanSendPlace } from '@liveworkspace/index-client';
import { describe, expect, it, vi } from 'vitest';
import { alreadySent, placeTitle, sendCards } from './send-cards';
import {
  canSendToPlan,
  onSendToPlan,
  openSendToPlan,
  sendPlace,
  type SendRequest,
} from './send-to-plan-entry';

const TODAY = new Date(2026, 10, 18);
const place = (text: string, elementId = 'e1'): PlanSendPlace =>
  sendPlace({ app: 'livediagram', itemId: 'D', kind: 'element', tabId: 't1', elementId, text });

const send = (ref: string): PlanSend => ({
  id: 'ps_1',
  ref,
  kind: 'element',
  plan: { id: 'P', title: 'Sprint' },
  card: { id: 'c1', title: 'T', column: 'To Do', done: false },
  link: 'https://x',
  at: 1,
});

describe('the cards a send makes', () => {
  it('makes one card from one place, its title as left, assigned and due', () => {
    expect(
      sendCards(
        [place('Fix it @ben by Friday')],
        { mode: 'each', title: ' ', assignee: 'Ben', due: '2026-11-20' },
        TODAY,
      ),
    ).toEqual([
      {
        title: 'Fix it',
        places: [place('Fix it @ben by Friday')],
        assignee: 'Ben',
        due: '2026-11-20',
      },
    ]);
    expect(sendCards([], { mode: 'each', title: 'x', assignee: '', due: '' }, TODAY)).toEqual([]);
  });

  it('makes one card each, or one card with a checklist of them', () => {
    const two = [place('One', 'a'), place('Two', 'b')];
    const each = sendCards(two, { mode: 'each', title: 'ignored', assignee: '', due: '' }, TODAY);
    expect(each.map((c) => c.title)).toEqual(['One', 'Two']);
    const list = sendCards(
      two,
      { mode: 'checklist', title: 'Retro', assignee: '', due: '' },
      TODAY,
    );
    expect(list).toEqual([{ title: 'Retro', places: two, checklist: ['One', 'Two'] }]);
  });

  it('titles a place whose first line is all mention and date with its words', () => {
    expect(placeTitle(place('@ben tomorrow'), TODAY)).toBe('@ben tomorrow');
    expect(placeTitle(place(`@ben ${'x'.repeat(300)}`), TODAY)).toHaveLength(120);
    expect(placeTitle(place(`@ben tomorrow ${'y'.repeat(150)}`), TODAY).length).toBeLessThanOrEqual(
      120,
    );
    expect(placeTitle({ ...place('x'), text: '@a tomorrow\nmore' }, TODAY)).toBe('more');
    expect(placeTitle({ ...place('x'), text: '@a tomorrow\n@b' }, TODAY)).toBe('@a tomorrow');
    expect(placeTitle(place(`@${'b'.repeat(300)}`), TODAY)).toHaveLength(120);
    // A title typed longer than a card takes is cut to it.
    const [long] = sendCards(
      [place('x')],
      { mode: 'checklist', title: 'z'.repeat(400), assignee: '', due: '' },
      TODAY,
    );
    expect(long!.title.length).toBeLessThan(400);
  });

  it('finds the send already made from the same place', () => {
    const p = place('One');
    expect(
      alreadySent([p], [send('element:t1:e9:'), send(planSendRef(p))], planSendRef),
    ).toMatchObject({
      ref: 'element:t1:e1:',
    });
    expect(alreadySent([p], [], planSendRef)).toBeNull();
  });
});

describe('the entries', () => {
  it('opens the picker with the places that have words, at most a send’s cards', () => {
    const heard = vi.fn<(request: SendRequest) => void>();
    const stop = onSendToPlan(heard);
    openSendToPlan({ places: [place('  ')], noun: 'sticky' });
    expect(heard).not.toHaveBeenCalled();
    const many = Array.from({ length: 25 }, (_, i) => place(`S${i}`, `e${i}`));
    openSendToPlan({ places: many, noun: 'stickies' });
    expect(heard).toHaveBeenCalledWith(expect.objectContaining({ cut: 25 }));
    expect(heard.mock.calls[0]![0].places).toHaveLength(20);
    openSendToPlan({ places: [place('One')], noun: 'sticky' });
    expect(heard.mock.calls[1]![0]).not.toHaveProperty('cut');
    stop();
    openSendToPlan({ places: [place('One')], noun: 'sticky' });
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('lets an account in person send, never Offline, an embed or Community', () => {
    expect(canSendToPlan({ signedIn: true })).toBe(true);
    expect(canSendToPlan({ signedIn: false })).toBe(false);
    expect(canSendToPlan({ signedIn: true, offline: true })).toBe(false);
    expect(canSendToPlan({ signedIn: true, embed: true })).toBe(false);
    expect(canSendToPlan({ signedIn: true, community: true })).toBe(false);
  });

  it('keys picked words by their text, and clips what is too long', () => {
    const words = sendPlace({
      app: 'livedocuments',
      itemId: 'D',
      kind: 'text',
      text: ' Hello  World ',
      label: 'Page 1',
    });
    expect(words).toMatchObject({
      kind: 'text',
      tabId: null,
      elementId: null,
      label: 'Page 1',
      text: 'Hello  World',
    });
    expect(words.part).toMatch(/^[0-9a-f]{8}$/);
    const long = sendPlace({
      app: 'livedocuments',
      itemId: 'D',
      kind: 'thread',
      text: 'x'.repeat(3000),
      label: 'y'.repeat(200),
    });
    expect(long.text).toHaveLength(2000);
    expect(long.label).toHaveLength(120);
    expect(long.part).toBeNull();
  });
});
