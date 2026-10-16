// The forms tasks of the benchmark (docs/instructions/evaluate-mcp-output.md). Each prompt is what a user would type;
// `checks` judge what the run made from the prompt's own requirements (see checks.mjs); `setup` makes what the
// prompt takes for granted ("our Bugs board") in the run's empty library, answering the ids of what it made.
import { resultJson } from '../mcp-client.mjs';
import { formsOf, questionAbout, questionsOf, replied } from '../checks.mjs';

// The run's form: the one with the most questions (a run makes one; a setup document holds none).
const form = (snap) => formsOf(snap).sort((a, b) => questionsOf(b).length - questionsOf(a).length)[0] ?? null;
const asks = (snap, words) => {
  const f = form(snap);
  const missing = words.filter((w) => !questionAbout(f, w));
  return { pass: !!f && missing.length === 0, detail: !f ? 'no form' : missing.length ? `no question about ${missing.map((m) => m.source).join(', ')}` : null };
};
const noProblems = ['nothing stops it being published', ({ snap }) => { const f = form(snap); return { pass: !!f && (f.problems ?? []).length === 0, detail: (f?.problems ?? []).join('; ') || null }; }];

export default [
  {
    id: 'Q1',
    level: 'easy',
    prompt: "Make an RSVP form for our office holiday party on 18 December: name, whether they're coming, plus-one, and dietary needs. Send me the link.",
    checks: [
      ['asks name, coming, plus-one and dietary needs', ({ snap }) => asks(snap, [/name/i, /coming|attend|join/i, /plus.?one|guest/i, /diet/i])],
      ['coming is a choice', ({ snap }) => ['single', 'checkbox'].includes(questionAbout(form(snap), /coming|attend|join/i)?.type)],
      ['it is published', ({ snap }) => ({ pass: form(snap)?.state === 'accepting', detail: form(snap)?.state })],
      ['the reply gives the link', ({ run, snap }) => { const link = form(snap)?.link; return { pass: !!link && replied(run, link.split('/').at(-1)), detail: link ? null : 'no link made' }; }],
      noProblems,
    ],
  },
  {
    id: 'Q2',
    level: 'medium',
    async setup(client) {
      const made = resultJson(
        await client.call('create_document', { name: 'Bugs', tabs: [{ template: 'bug-triage' }] }),
      );
      if (!made?.documentId) throw new Error('Q2 setup: the Bugs document was not made');
      return [made.documentId];
    },
    prompt: "We need a bug report form customers can fill in. Reports should land on our Bugs board as Bug cards, with severity and the browser they used as card fields, and the summary as the card title.",
    checks: [
      ['the form is in the Bugs document', ({ snap }) => (snap.documents ?? []).some((d) => d.name === 'Bugs' && (d.tabs ?? []).some((t) => t.form))],
      ['responses land as Bug cards', ({ snap }) => ({ pass: form(snap)?.respondsTo?.to === 'board' && /bug/i.test(form(snap)?.respondsTo?.cardType ?? ''), detail: JSON.stringify(form(snap)?.respondsTo ?? null) })],
      ['the summary is the card title', ({ snap }) => ({ pass: questionAbout(form(snap), /summary|title/i)?.goesTo === 'Title', detail: questionAbout(form(snap), /summary|title/i)?.goesTo ?? 'no summary question' })],
      ['severity goes to a card field', ({ snap }) => /severity/i.test(questionAbout(form(snap), /severity/i)?.goesTo ?? '')],
      ['browser goes to a card field', ({ snap }) => /browser/i.test(questionAbout(form(snap), /browser/i)?.goesTo ?? '')],
      noProblems,
    ],
  },
  {
    id: 'Q3',
    level: 'medium',
    prompt: "Create a post-workshop feedback survey: overall rating out of 10, what worked, what didn't, would they recommend us, and an optional email. Responses should go into a spreadsheet.",
    checks: [
      ['asks all five', ({ snap }) => asks(snap, [/overall|rating|rate/i, /work(ed)? well|what worked/i, /didn.?t|not work|improve/i, /recommend/i, /email/i])],
      ['the rating is out of 10', ({ snap }) => { const q = questionAbout(form(snap), /overall|rating|rate/i); return { pass: !!q && (q.max === 10 || q.scale === 10 || q.steps === 10 || /10/.test(JSON.stringify(q))), detail: q ? JSON.stringify(q).slice(0, 160) : 'no rating' }; }],
      ['recommend is a choice or a scale', ({ snap }) => ['single', 'rating', 'number', 'checkbox'].includes(questionAbout(form(snap), /recommend/i)?.type)],
      ['the email is optional and an email', ({ snap }) => { const q = questionAbout(form(snap), /email/i); return { pass: q?.type === 'email' && !q.required, detail: q ? `${q.type}, required ${!!q.required}` : 'no email question' }; }],
      ['responses go to a sheet', ({ snap }) => ({ pass: form(snap)?.respondsTo?.to === 'sheet', detail: form(snap)?.respondsTo?.to })],
      noProblems,
    ],
  },
  {
    id: 'Q4',
    level: 'hard',
    prompt: "Build a job application form for a senior engineer role in three pages: about you (name, email, LinkedIn), experience (years, current stack as multiple choice, a short paragraph on a project they're proud of), and logistics (notice period, salary expectation, right to work). Only show a visa question if they say they don't have the right to work. Candidates should land in a hiring pipeline board. Make it look branded with a cover.",
    checks: [
      ['three pages', ({ snap }) => ({ pass: (form(snap)?.sections ?? []).filter((s) => !s.showIf).length >= 3, detail: `${(form(snap)?.sections ?? []).length} sections` })],
      ['about you: name, email, LinkedIn', ({ snap }) => asks(snap, [/name/i, /email/i, /linkedin/i])],
      ['experience: years, stack, a project', ({ snap }) => asks(snap, [/years/i, /stack/i, /project/i])],
      ['the stack is multiple choice', ({ snap }) => ({ pass: questionAbout(form(snap), /stack/i)?.type === 'multi', detail: questionAbout(form(snap), /stack/i)?.type })],
      ['the project is a paragraph', ({ snap }) => questionAbout(form(snap), /project/i)?.type === 'paragraph'],
      ['logistics: notice, salary, right to work', ({ snap }) => asks(snap, [/notice/i, /salary/i, /right to work/i])],
      ['the visa question shows only without the right to work', ({ snap }) => { const f = form(snap); const rtw = questionAbout(f, /right to work/i); const visa = (f?.sections ?? []).find((s) => (s.questions ?? []).some((q) => /visa|sponsor/i.test(q.prompt))); return { pass: !!visa?.showIf && visa.showIf.questionId === rtw?.id && visa.showIf.anyOf.every((a) => /^no\b/i.test(a)), detail: visa ? JSON.stringify(visa.showIf ?? 'always shown') : 'no visa question' }; }],
      ['candidates land on a hiring board', ({ snap }) => ({ pass: form(snap)?.respondsTo?.to === 'board', detail: JSON.stringify(form(snap)?.respondsTo ?? null) })],
      ['a cover', ({ snap }) => !!form(snap)?.cover],
      noProblems,
    ],
  },
  {
    id: 'Q5',
    level: 'edit',
    after: 'Q1',
    prompt: "Close the RSVP at 5pm on 15 December, cap it at 80 people, add a question asking which session they'll attend (afternoon or evening), and make dietary needs required.",
    checks: [
      ['closes at 5pm on 15 December', ({ snap }) => { const c = form(snap)?.settings?.closesAt; return { pass: !!c && /2026-12-15T(17|16):00/.test(c), detail: c ?? 'no close time' }; }],
      ['capped at 80', ({ snap }) => ({ pass: form(snap)?.settings?.limit === 80, detail: String(form(snap)?.settings?.limit) })],
      ['asks which session: afternoon or evening', ({ snap }) => { const q = questionAbout(form(snap), /session/i); const opts = (q?.options ?? []).join(' '); return { pass: !!q && /afternoon/i.test(opts) && /evening/i.test(opts), detail: q ? opts : 'no session question' }; }],
      ['dietary needs are required', ({ snap }) => questionAbout(form(snap), /diet/i)?.required === true],
      ['the RSVP questions are kept', ({ snap }) => asks(snap, [/name/i, /coming|attend|join/i, /plus.?one|guest/i])],
      noProblems,
    ],
  },
];
