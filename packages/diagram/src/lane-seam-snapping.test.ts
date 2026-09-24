import { describe, expect, it } from 'vitest';
import {
  alignmentCoordinates,
  laneSeamCoordinates,
  SEAM_SNAP_THRESHOLD,
  snapSeamCoordinate,
} from './lane-seam-snapping';
import type { Element } from './index';

const lane = (id: string, x: number, y: number, width = 600, height = 200): Element =>
  ({ id, type: 'shape', shape: 'lane', x, y, width, height, label: id }) as Element;

const box = (id: string, x: number, y: number, width = 100, height = 60): Element =>
  ({ id, type: 'shape', shape: 'square', x, y, width, height, label: id }) as Element;

describe('lane seam snapping', () => {
  describe('laneSeamCoordinates', () => {
    it('places a left-headed laneseam at x + size', () => {
      const els = [lane('a', 100, 0), lane('b', 100, 300)];
      const coords = laneSeamCoordinates(
        els,
        'x',
        'a',
        () => 'left',
        () => 132,
      );
      expect(coords).toEqual([232]);
    });

    it('measures a right-headed lane from its far edge', () => {
      const els = [lane('b', 100, 300, 600)];
      const coords = laneSeamCoordinates(
        els,
        'x',
        'a',
        () => 'right',
        () => 132,
      );
      expect(coords).toEqual([100 + 600 - 132]);
    });

    it('ignores the lane being dragged', () => {
      const els = [lane('a', 100, 0)];
      expect(
        laneSeamCoordinates(
          els,
          'x',
          'a',
          () => 'left',
          () => 132,
        ),
      ).toEqual([]);
    });

    it('ignores lanes whose heading runs along the other axis', () => {
      // A column's seam and a row's seam are different lines; lining them up
      // would mean nothing.
      const els = [lane('b', 100, 300)];
      expect(
        laneSeamCoordinates(
          els,
          'x',
          'a',
          () => 'top',
          () => 64,
        ),
      ).toEqual([]);
      expect(
        laneSeamCoordinates(
          els,
          'y',
          'a',
          () => 'top',
          () => 64,
        ),
      ).toEqual([364]);
    });

    it('ignores anything that is not a lane', () => {
      const els = [box('b', 100, 0)];
      expect(
        laneSeamCoordinates(
          els,
          'x',
          'a',
          () => 'left',
          () => 132,
        ),
      ).toEqual([]);
    });
  });

  describe('alignmentCoordinates', () => {
    it('offers each element edge and its centre', () => {
      expect(alignmentCoordinates([box('b', 100, 0, 80)], 'x', 'a')).toEqual([100, 140, 180]);
    });

    it('skips the dragged element', () => {
      expect(alignmentCoordinates([box('a', 100, 0)], 'x', 'a')).toEqual([]);
    });
  });

  describe('snapSeamCoordinate', () => {
    const none = { seams: [], alignment: [] };

    it('leaves a seam alone when nothing is near', () => {
      expect(snapSeamCoordinate(200, none)).toEqual({ value: 200, snappedTo: null });
      expect(snapSeamCoordinate(200, { seams: [400], alignment: [] })).toEqual({
        value: 200,
        snappedTo: null,
      });
    });

    it('takes the nearest target within the threshold', () => {
      const r = snapSeamCoordinate(200, { seams: [], alignment: [196, 240] });
      expect(r).toEqual({ value: 196, snappedTo: 196 });
    });

    it('snaps exactly at the threshold but not beyond it', () => {
      const edge = 200 + SEAM_SNAP_THRESHOLD;
      expect(snapSeamCoordinate(200, { seams: [edge], alignment: [] }).snappedTo).toBe(edge);
      expect(snapSeamCoordinate(200, { seams: [edge + 1], alignment: [] }).snappedTo).toBeNull();
    });

    it('prefers another lane seam over an element edge at the same distance', () => {
      // Lining a heading up with the lane above is what the user meant; an
      // element that happens to sit at the same offset is a coincidence.
      const r = snapSeamCoordinate(200, { seams: [204], alignment: [196] });
      expect(r.value).toBe(204);
    });

    it('still takes a strictly nearer element edge over a further seam', () => {
      const r = snapSeamCoordinate(200, { seams: [206], alignment: [201] });
      expect(r.value).toBe(201);
    });
  });
});
