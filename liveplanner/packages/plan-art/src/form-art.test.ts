import { describe, expect, it } from 'vitest';
import { formLook } from '@liveplanner/project';
import { QUESTION_TYPES, blankQuestion, type FormDefinition } from '@liveplanner/forms';
import { FORM_ART_HEIGHT_MAX, FORM_ART_WIDTH, formArt } from './form-art';

// read_form's picture (docs/specs/030-forms/forms.md "Agents", blueprint §15): the form as respondents see it.
const every: FormDefinition = {
  v: 1,
  heading: 'Every Type',
  description: 'One of each.',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: QUESTION_TYPES.map((t, i) => ({
        ...blankQuestion(t, `q-${i}`),
        prompt: `Q ${t}`,
        required: true,
      })),
    },
    {
      id: 's-2',
      title: 'Later',
      showIf: { questionId: 'q-6', anyOf: ['Option 1'] },
      questions: [],
    },
  ],
};

describe('formArt', () => {
  it('draws the heading, every question and the sections on the tab’s look', () => {
    const art = formArt(every, formLook({ theme: 'ocean' }));
    expect(art.width).toBe(FORM_ART_WIDTH);
    for (const t of QUESTION_TYPES) expect(art.svg).toContain(`Q ${t}`);
    expect(art.svg).toContain('Every Type');
    // Its later section shows only sometimes, so no count is given.
    expect(art.svg).toContain('>Section 2<');
    expect(art.svg).toContain('Shown when “Q single” is “Option 1”');
    const always = {
      ...every,
      sections: [every.sections[0]!, { ...every.sections[1]!, showIf: undefined }],
    };
    expect(formArt(always, formLook({})).svg).toContain('Section 2 of 2');
    expect(art.svg).toContain('Submit');
    expect(art.svg).toContain(formLook({ theme: 'ocean' }).accent.light);
    expect(art.svg.match(/<tspan fill="#dc2626"> \*<\/tspan>/g)).toHaveLength(
      QUESTION_TYPES.length,
    );
  });

  it('draws a gradient cover, and squares the boxes on a Professional finish', () => {
    const cover = {
      fill: { kind: 'gradient' as const, from: '#7c3aed', to: '#db2777', angle: 135 },
    };
    expect(formArt({ ...every, cover }, formLook({})).svg).toContain(
      '<linearGradient id="form-cover"',
    );
    expect(formArt(every, formLook({ finish: 'professional' })).svg).toContain('rx="2"');
  });

  it('draws the cover’s pattern over its colour', () => {
    const cover = { fill: { kind: 'solid' as const, color: '#0f766e' }, pattern: 'dots' as const };
    expect(formArt({ ...every, cover }, formLook({})).svg).toContain('url(#form-cover-pattern)');
  });

  it('flows a long form into a second column, then says how many questions it left out', () => {
    const many: FormDefinition = {
      ...every,
      sections: [
        {
          id: 's',
          title: '',
          questions: Array.from({ length: 100 }, (_, i) => ({
            ...blankQuestion('paragraph', `q${i}`),
            prompt: `P${i}`,
          })),
        },
      ],
    };
    const started = performance.now();
    const art = formArt(many, formLook({}));
    expect(performance.now() - started).toBeLessThan(200);
    expect(art.width).toBe(FORM_ART_WIDTH * 2);
    expect(art.height).toBeLessThanOrEqual(FORM_ART_HEIGHT_MAX);
    const drawn = (art.svg.match(/>P\d+</g) ?? []).length;
    // A plain lookup, not an unanchored \d+ regex, which backtracks on long runs of digits (CodeQL js/polynomial-redos).
    const note = art.svg.indexOf(' more questions not drawn');
    const left = Number(art.svg.slice(art.svg.lastIndexOf('>', note) + 1, note));
    expect(drawn + left).toBe(100);
  });

  it('keeps a paragraph placeholder’s line breaks', () => {
    const q = {
      ...blankQuestion('paragraph', 'q'),
      prompt: 'Steps',
      placeholder: '1. Go to\n2. Click',
    };
    const art = formArt(
      { ...every, sections: [{ id: 's', title: '', questions: [q] }] },
      formLook({}),
    );
    expect(art.svg).toContain('>1. Go to<');
    expect(art.svg).toContain('>2. Click<');
  });

  it('keeps a short form to one column', () => {
    expect(formArt(every, formLook({})).width).toBe(FORM_ART_WIDTH);
  });
});
