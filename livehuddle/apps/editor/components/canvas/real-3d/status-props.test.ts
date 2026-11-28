import { describe, expect, it } from 'vitest';
import { Bone, Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { AVATAR_CALL_STATUSES } from '@livehuddle/avatar/status';
import { handProp, headPropsOf, StatusProps, statusHandProp } from './status-props';
import type { GameFigure } from './game-figure';
import { anyGesture, easeGestures, gestureTakesHand, NO_GESTURES } from './figure-gestures';

// docs/specs/008-canvas/avatar-mode.md "Status": every status's signature on the 3D character.
describe('status signatures', () => {
  it('gives every status but Away a signature, on the head or in the hand', () => {
    for (const { id } of AVATAR_CALL_STATUSES) {
      const has = headPropsOf(id).length > 0 || statusHandProp(id) !== null;
      expect(has, id).toBe(id !== 'away');
    }
  });

  it('carries the sandwich, the bottle and the phone in the hand', () => {
    expect(statusHandProp('lunch')).toBe('sandwich');
    expect(statusHandProp('break')).toBe('bottle');
    expect(statusHandProp('busy')).toBe('phone');
    expect(statusHandProp('focus')).toBeNull();
    expect(statusHandProp(null)).toBeNull();
  });

  it('wears the head props the spec names', () => {
    expect(headPropsOf('focus')).toEqual(['headphones']);
    expect(headPropsOf('meeting')).toEqual(['headset']);
    expect(headPropsOf('celebrating')).toEqual(['party-hat', 'confetti']);
    expect(headPropsOf('sick')).toEqual(['ice-pack', 'sweat']);
    expect(headPropsOf(null)).toEqual([]);
  });

  it('builds each hand prop life-sized (under half a head across, about a hand tall)', () => {
    for (const kind of ['sandwich', 'bottle', 'phone'] as const) {
      const size = new Box3().setFromObject(handProp(kind)).getSize(new Vector3());
      expect(Math.max(size.x, size.y, size.z), kind).toBeLessThan(2.2);
      expect(Math.max(size.x, size.y, size.z), kind).toBeGreaterThan(1);
    }
  });
});

describe('gestures', () => {
  it('ease in toward a gesture and out to exactly nothing', () => {
    let g = NO_GESTURES;
    for (let i = 0; i < 3; i++) g = easeGestures(g, { ...NO_GESTURES, handUp: 1 }, 1 / 60);
    expect(g.handUp).toBeGreaterThan(0);
    expect(g.handUp).toBeLessThan(1);
    expect(gestureTakesHand(g)).toBe(true);
    for (let i = 0; i < 120; i++) g = easeGestures(g, NO_GESTURES, 1 / 60);
    expect(g).toBe(NO_GESTURES);
    expect(anyGesture(g)).toBe(false);
  });

  it('stays the same object while nothing gestures, so a still figure does no work', () => {
    expect(easeGestures(NO_GESTURES, NO_GESTURES, 1 / 60)).toBe(NO_GESTURES);
  });

  it('follows the clap beat at once', () => {
    const g = easeGestures(NO_GESTURES, { ...NO_GESTURES, clap: 1, beat: 0.8 }, 1 / 60);
    expect(g.beat).toBe(0.8);
  });

  it('leaves the hand to a status prop under the phone and the bite', () => {
    expect(gestureTakesHand({ ...NO_GESTURES, phone: 1, bite: 1 })).toBe(false);
  });
});

// docs/specs/008-canvas/3d-engine.md "Chips over heads": the head's reach is measured from the figure, hair and props.
describe('the head reach the chip clears', () => {
  // A stand-in figure: feet at the origin, the head bone 15 up, and a body whose top (the hair) is `top` up.
  function figure(top: number): GameFigure {
    const object = new Group();
    const bone = new Bone();
    bone.name = 'Head';
    bone.position.z = 15;
    object.add(bone);
    const body = new Mesh(new BoxGeometry(4, 2, top), new MeshBasicMaterial());
    body.position.z = top / 2;
    object.add(body);
    return { object } as unknown as GameFigure;
  }

  it('is the hair top over the feet for a status with nothing on the head', () => {
    for (const status of [null, 'lunch', 'busy'] as const) {
      const props = new StatusProps(figure(17.6));
      props.show(status);
      expect(props.reach(), String(status)).toBeCloseTo(17.6, 3);
    }
  });

  it('rises with a taller hairstyle', () => {
    const short = new StatusProps(figure(17.6));
    const tall = new StatusProps(figure(19.4));
    expect(tall.reach()! - short.reach()!).toBeCloseTo(1.8, 3);
  });

  it('takes in a head prop that stands over the hair (the party hat)', () => {
    const props = new StatusProps(figure(17.6));
    props.show('celebrating');
    expect(props.reach()!).toBeGreaterThan(17.6 + 0.5);
    props.show(null);
    expect(props.reach()).toBeCloseTo(17.6, 3);
  });

  it('answers nothing for a figure with no head bone', () => {
    expect(new StatusProps({ object: new Group() } as unknown as GameFigure).reach()).toBeNull();
  });
});
