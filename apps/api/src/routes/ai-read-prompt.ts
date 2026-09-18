// What the model is asked of a sticky-note crop (spec/139 Phase 8).
//
// One question, and a narrow one: what does this piece of paper say. It is not
// asked what colour the note is (we measured that), where it is (we measured
// that too), or what it means. The narrower the question, the less there is to
// hallucinate.

export function buildReadNotesPrompt(): string {
  return [
    'Each image is ONE sticky note from an event-storming wall, photographed and',
    'cropped. The writing is a marker pen, usually in capitals, often untidy.',
    '',
    'For each crop, return the text on it VERBATIM: exactly as written, including',
    'abbreviations, shorthand, ampersands and misspellings. Do not correct it, do',
    'not expand it, do not translate it, do not tidy it up. These are domain terms,',
    'and a helpful rewrite renames somebody’s business.',
    '',
    'If you cannot read a crop — too blurred, too dark, mostly covered, or blank —',
    'return an empty string for it and set legible to false. Do NOT guess: a note',
    'with no words is useful (the paper was there), and an invented phrase is not.',
    '',
    'Ignore anything that is not writing on the note: a shadow, a thumb, the wall',
    'behind it, the edge of the next sticky.',
    '',
    'Answer with JSON only, in exactly this shape:',
    '{"texts":[{"id":<the crop id>,"text":"<verbatim>","legible":true|false}]}',
    'One entry per crop, using the id each crop was labelled with.',
  ].join('\n');
}
