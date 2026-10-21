import { describe, expect, it } from 'vitest';
import { closeRadiusFor } from './detect';

// How far the morphological close reaches, against the note it repairs.
describe('closeRadiusFor', () => {
  it('closes by one pixel on the notes of a wall photographed at 1000px', () => {
    // Notes on the labelled walls measure 19 to 51px at the working size.
    for (const note of [19, 33, 38, 41, 48, 51]) expect(closeRadiusFor(note, 1000)).toBe(1);
  });

  it('still grows with the note on a close-up', () => {
    expect(closeRadiusFor(100, 1000)).toBe(2);
    expect(closeRadiusFor(200, 1000)).toBe(4);
  });

  it('never reaches past its cap on the frame, nor below a pixel', () => {
    expect(closeRadiusFor(1000, 1000)).toBe(6);
    expect(closeRadiusFor(5, 1000)).toBe(1);
  });

  it('falls back to the cap when no note could be measured', () => {
    expect(closeRadiusFor(0, 1000)).toBe(6);
  });
});
