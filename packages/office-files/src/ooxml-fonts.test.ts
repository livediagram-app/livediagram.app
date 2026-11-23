import { describe, expect, it } from 'vitest';
import { FONTS } from '@liveworkspace/model-core/fonts';
import { fontTableXml, officeFace, pitchFamilyOf } from './ooxml-fonts';

describe('officeFace', () => {
  it('maps every curated font to a face every Office install has', () => {
    const safe = new Set([
      'Arial',
      'Arial Narrow',
      'Georgia',
      'Times New Roman',
      'Courier New',
      'Comic Sans MS',
    ]);
    for (const f of FONTS) expect(safe.has(officeFace(f.label).alt), f.label).toBe(true);
  });

  it('keeps code on a fixed-width face and a serif on a serif', () => {
    expect(officeFace('Roboto Mono')).toMatchObject({ family: 'modern', fixed: true });
    expect(officeFace('Lora').family).toBe('roman');
    expect(officeFace('Inter').family).toBe('swiss');
  });

  it('guesses an unknown face from its name, defaulting to a sans', () => {
    expect(officeFace('JetBrains Mono')).toMatchObject({ fixed: true, alt: 'Courier New' });
    expect(officeFace('Playfair Serif').family).toBe('roman');
    expect(officeFace('Open Sans')).toMatchObject({ family: 'swiss', alt: 'Arial' });
    expect(officeFace('Source Sans Serif').family).toBe('swiss');
  });
});

describe('pitchFamilyOf', () => {
  it('is the family nibble plus the pitch', () => {
    expect(pitchFamilyOf('Inter')).toBe(0x22);
    expect(pitchFamilyOf('Lora')).toBe(0x12);
    expect(pitchFamilyOf('Roboto Mono')).toBe(0x31);
    expect(pitchFamilyOf('Kalam')).toBe(0x42);
  });
});

describe('fontTableXml', () => {
  it('lists each face once, escaped, with its stand-in', () => {
    const xml = fontTableXml(['Inter', 'Inter', 'Roboto Mono', 'A&B']);
    expect(xml.match(/<w:font /g)).toHaveLength(3);
    expect(xml).toContain('w:name="A&amp;B"');
    expect(xml).toContain('<w:pitch w:val="fixed"/>');
  });
});
