// @vitest-environment jsdom
// Real 3D's office dog (docs/specs/008-canvas/3d-engine.md "The office dog"): a model for each Pet Bed's dog drawing,
// posed each frame from the drawing's marks (asleep in its bed, trotting on the floor, patted), gone with its drawing,
// glowing under the pointer, and a press on it patting it through the drawing's own Pat the Dog button.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { setReal3DProjector } from '@/lib/real-3d/real-3d-pick';
import { OfficeDogs } from './office-dog';

const BED = { id: 'bed', shape: 'pet-bed', x: 100, y: 100, width: 60, height: 40 };

beforeAll(() => {
  // jsdom has no DOMMatrix; the dog reads only the drawing's translation from it.
  const g = globalThis as { DOMMatrix?: unknown };
  g.DOMMatrix ??= class {
    m41 = 0;
    m42 = 0;
  };
});

afterEach(() => {
  setReal3DProjector(null);
  document.body.replaceChildren();
});

/** A canvas holding one Pet Bed's dog drawing, with the marks the drawing sets. */
function board(marks: Record<string, string> = {}, onPat = () => {}) {
  const main = document.createElement('main');
  const bed = document.createElement('div');
  bed.setAttribute('data-element-id', 'bed');
  const floor = document.createElement('div');
  const dog = document.createElement('div');
  dog.setAttribute('data-pet', 'awake');
  for (const [k, v] of Object.entries(marks)) dog.setAttribute(k, v);
  const pat = document.createElement('button');
  pat.setAttribute('aria-label', 'Pat the Dog');
  pat.addEventListener('click', onPat);
  dog.append(pat);
  floor.append(dog);
  bed.append(floor);
  main.append(bed);
  document.body.append(main);
  return { main, dog, floor };
}

const bedOf = (id: string) => (id === 'bed' ? BED : undefined);

function press(target: Element, type: string, x: number, y: number) {
  const e = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  target.dispatchEvent(e);
  return e;
}

describe('OfficeDogs', () => {
  it('adds a model for each dog drawing and removes it with its drawing', () => {
    const scene = new THREE.Scene();
    const { main, dog } = board();
    const dogs = new OfficeDogs(scene, main);
    dogs.update(0, 0.016, bedOf);
    expect(scene.children).toHaveLength(1);
    dogs.update(16, 0.016, bedOf);
    expect(scene.children).toHaveLength(1);
    dog.remove();
    dogs.update(32, 0.016, bedOf);
    expect(scene.children).toHaveLength(0);
    dogs.dispose();
  });

  it('skips a dog whose bed is not on the board', () => {
    const scene = new THREE.Scene();
    const { main } = board();
    const dogs = new OfficeDogs(scene, main);
    dogs.update(0, 0.016, () => undefined);
    expect(scene.children).toHaveLength(0);
    dogs.dispose();
  });

  it('lies down asleep in its bed and trots on the floor, over many frames', () => {
    const scene = new THREE.Scene();
    const { main, dog, floor } = board({ 'data-pet': 'asleep' });
    const dogs = new OfficeDogs(scene, main);
    for (let i = 0; i < 90; i++) dogs.update(i * 16, 0.016, bedOf);
    const root = scene.children[0]!;
    // Asleep at home: on the bed's cushion, in its middle.
    expect(root.position.z).toBeGreaterThan(0);
    expect(root.position.x).toBeCloseTo(BED.x + BED.width / 2, 0);
    // Awake and trotting on the floor, facing left, patted (a heart shows).
    dog.setAttribute('data-pet', 'awake');
    dog.setAttribute('data-pet-trot', '');
    dog.setAttribute('data-pet-left', '');
    floor.setAttribute('data-pet-floor', '');
    const heart = document.createElement('span');
    heart.setAttribute('data-pet-heart', '');
    dog.append(heart);
    for (let i = 90; i < 180; i++) dogs.update(i * 16, 0.016, bedOf);
    expect(root.position.z).toBeCloseTo(0, 3);
    dogs.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('pats the dog on a press and release over it, swallows the click, and glows under the pointer', () => {
    const scene = new THREE.Scene();
    const pat = vi.fn();
    const { main } = board({}, pat);
    // Canvas to screen, one to one.
    setReal3DProjector((x, y) => ({ x, y }));
    const dogs = new OfficeDogs(scene, main);
    dogs.update(0, 0.016, bedOf);
    const at = scene.children[0]!.position;
    press(main, 'pointermove', at.x, at.y);
    expect(main.style.cursor).toBe('pointer');
    const down = press(main, 'pointerdown', at.x, at.y);
    expect(down.defaultPrevented).toBe(true);
    const click = press(main, 'click', at.x, at.y);
    expect(click.defaultPrevented).toBe(true);
    press(main, 'pointerup', at.x, at.y);
    expect(pat).toHaveBeenCalledTimes(1);
    // Off the dog: no pointer, and a press there is the canvas's own.
    press(main, 'pointermove', at.x + 5000, at.y);
    expect(main.style.cursor).toBe('');
    expect(press(main, 'pointerdown', at.x + 5000, at.y).defaultPrevented).toBe(false);
    // A cancelled press pats nothing.
    press(main, 'pointerdown', at.x, at.y);
    press(main, 'pointercancel', at.x, at.y);
    press(main, 'pointerup', at.x, at.y);
    expect(pat).toHaveBeenCalledTimes(1);
    dogs.dispose();
  });
});
