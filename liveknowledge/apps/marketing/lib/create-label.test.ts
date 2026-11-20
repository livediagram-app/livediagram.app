import { describe, expect, it } from 'vitest';
import { createLabelPrefix } from './create-label';

describe('createLabelPrefix', () => {
  it('says "an" before a vowel sound and "a" before the rest', () => {
    expect(createLabelPrefix('Infographic')).toBe('Create an ');
    expect(createLabelPrefix('Invoice')).toBe('Create an ');
    expect(createLabelPrefix('Empathy Map')).toBe('Create an ');
    expect(createLabelPrefix('OKRs')).toBe('Create an ');
    expect(createLabelPrefix('Affinity Map')).toBe('Create an ');
    expect(createLabelPrefix('Blank Diagram')).toBe('Create a ');
    expect(createLabelPrefix('Crazy 8s')).toBe('Create a ');
  });

  it('keeps "a" where the vowel is said "you"', () => {
    expect(createLabelPrefix('User Persona')).toBe('Create a ');
    expect(createLabelPrefix('User Story Map')).toBe('Create a ');
    expect(createLabelPrefix('UML Class')).toBe('Create a ');
  });
});
