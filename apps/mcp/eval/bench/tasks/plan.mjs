// The plan tasks of the benchmark (docs/instructions/evaluate-mcp-output.md). Each prompt is what a user would type;
// `checks` judge what the run made from the prompt's own requirements (see checks.mjs).
import { assigneesOf, atLeast, boardsOf, columnNames, fieldOf, itemsOf, typeNamed } from '../checks.mjs';

// The cards of a type (by name), wherever they sit.
const cardsOf = (snap, word) => {
  const type = typeNamed(snap, word);
  return type ? itemsOf(snap).filter((i) => i.type === type.id) : [];
};
// The built-in fields a card type can hold, by the kind of value each takes.
const BUILT_IN = { due: 'date', assignee: 'person', description: 'longtext', estimate: 'number', priority: 'choice' };
// A field of a type, by name, of one of the kinds given; a date asked for is met by the type's built-in Due Date.
const field = (snap, typeWord, fieldWord, kinds) => {
  const type = typeNamed(snap, typeWord);
  if (kinds?.includes('date') && (type?.fields ?? []).includes('due') && !fieldOf(type, fieldWord)) return { pass: true, detail: null };
  const f = fieldOf(type, fieldWord);
  if (!f) return { pass: false, detail: `no ${fieldWord.source ?? fieldWord} field on ${typeWord.source ?? typeWord}` };
  return { pass: !kinds || kinds.includes(f.kind), detail: kinds && !kinds.includes(f.kind) ? `${f.name} is ${f.kind}` : null };
};
// A board whose columns include every word, in that order.
const boardWithColumns = (snap, words) => {
  const ok = boardsOf(snap).some((b) => {
    const names = columnNames(b);
    let at = -1;
    return words.every((w) => {
      const i = names.findIndex((n, k) => k > at && w.test(n));
      if (i < 0) return false;
      at = i;
      return true;
    });
  });
  return { pass: ok, detail: ok ? null : `boards: ${boardsOf(snap).map((b) => `${b.title} [${columnNames(b).join(', ')}]`).join('; ')}` };
};
const choiceHas = (snap, typeWord, fieldWord, options) => {
  const f = fieldOf(typeNamed(snap, typeWord), fieldWord);
  const have = (f?.options ?? []).map((o) => (typeof o === 'string' ? o : o?.name ?? o?.label ?? '').toLowerCase());
  const missing = options.filter((o) => !have.some((h) => o.test(h)));
  return { pass: !!f && missing.length === 0, detail: missing.length ? `options ${have.join(', ')}; missing ${missing.map((m) => m.source).join(', ')}` : null };
};

export default [
  {
    id: 'P1',
    level: 'easy',
    prompt: "Set up a kanban board for our website redesign with 10 realistic cards spread over the columns, assigned to Ana, Raj and Lee.",
    checks: [
      ['a board with columns', ({ snap }) => atLeast(3, Math.max(0, ...boardsOf(snap).map((b) => (b.columns ?? []).length)), 'columns')],
      ['10 cards', ({ snap }) => atLeast(10, itemsOf(snap).length, 'cards')],
      ['spread over the columns', ({ snap }) => atLeast(3, new Set(itemsOf(snap).map((i) => i.status)).size, 'columns used')],
      ['assigned to Ana, Raj and Lee', ({ snap }) => { const people = new Set(itemsOf(snap).flatMap(assigneesOf)); const missing = ['ana', 'raj', 'lee'].filter((p) => !people.has(p)); return { pass: missing.length === 0, detail: missing.length ? `nobody named ${missing.join(', ')}` : null }; }],
      ['every card has someone', ({ snap }) => atLeast(Math.max(1, itemsOf(snap).length), itemsOf(snap).filter((i) => assigneesOf(i).length > 0).length, 'assigned cards')],
    ],
  },
  {
    id: 'P2',
    level: 'medium',
    prompt: "Bug tracker board: bugs need severity (critical to low), component, browser, steps to reproduce, and a link to the Sentry issue. Add 8 realistic bugs.",
    checks: [
      ['a Bug card type', ({ snap }) => !!typeNamed(snap, /bug/i)],
      ['severity from critical to low', ({ snap }) => choiceHas(snap, /bug/i, /severity/i, [/critical/i, /low/i])],
      ['component', ({ snap }) => field(snap, /bug/i, /component/i)],
      ['browser', ({ snap }) => field(snap, /bug/i, /browser/i)],
      ['steps to reproduce', ({ snap }) => field(snap, /bug/i, /steps|repro/i, ['text', 'longtext'])],
      ['a link to the Sentry issue', ({ snap }) => field(snap, /bug/i, /sentry/i, ['link'])],
      ['8 bugs', ({ snap }) => atLeast(8, cardsOf(snap, /bug/i).length, 'bugs')],
      ['the bugs carry a severity', ({ snap }) => atLeast(8, cardsOf(snap, /bug/i).filter((i) => Object.entries(i.fields ?? {}).some(([k, v]) => /severity/i.test(k) && v)).length, 'bugs with a severity')],
    ],
  },
  {
    id: 'P3',
    level: 'medium',
    prompt: "Hiring pipeline for 3 roles: candidates with role, source, salary expectation, CV link, interview date and a 1 to 5 rating; columns from applied to hired/rejected. Add 9 candidates.",
    checks: [
      ['a candidate card type', ({ snap }) => !!typeNamed(snap, /candidate|applicant/i)],
      ['role', ({ snap }) => field(snap, /candidate|applicant/i, /role|position/i)],
      ['source', ({ snap }) => field(snap, /candidate|applicant/i, /source/i)],
      ['salary expectation as a number', ({ snap }) => field(snap, /candidate|applicant/i, /salary/i, ['number', 'currency'])],
      ['CV link', ({ snap }) => field(snap, /candidate|applicant/i, /cv|resume|résumé/i, ['link'])],
      ['interview date', ({ snap }) => field(snap, /candidate|applicant/i, /interview/i, ['date'])],
      ['a 1 to 5 rating', ({ snap }) => field(snap, /candidate|applicant/i, /rating|score/i, ['rating', 'number', 'choice'])],
      ['columns from applied to hired and rejected', ({ snap }) => boardWithColumns(snap, [/appl/i, /hired/i])],
      ['a rejected column', ({ snap }) => ({ pass: boardsOf(snap).some((b) => columnNames(b).some((n) => /reject/i.test(n))) })],
      ['9 candidates over 3 roles', ({ snap }) => { const cs = cardsOf(snap, /candidate|applicant/i); const roles = new Set(cs.map((c) => Object.entries(c.fields ?? {}).find(([k]) => /role|position/i.test(k))?.[1]).filter(Boolean).map(String)); return { pass: cs.length >= 9 && roles.size >= 3, detail: `${cs.length} candidates, ${roles.size} roles` }; }],
    ],
  },
  {
    id: 'P4',
    level: 'medium',
    prompt: "Content calendar: posts with channel (LinkedIn, X, Blog, Newsletter), publish date, draft copy, asset link and owner. Columns idea, drafting, review, scheduled, published. 10 posts.",
    checks: [
      ['a post card type', ({ snap }) => !!typeNamed(snap, /post|content/i)],
      ['channel: LinkedIn, X, Blog, Newsletter', ({ snap }) => choiceHas(snap, /post|content/i, /channel/i, [/linkedin/i, /^x\b|twitter/i, /blog/i, /newsletter/i])],
      ['publish date', ({ snap }) => field(snap, /post|content/i, /publish|date/i, ['date'])],
      ['draft copy', ({ snap }) => field(snap, /post|content/i, /draft|copy/i, ['text', 'longtext'])],
      ['asset link', ({ snap }) => field(snap, /post|content/i, /asset/i, ['link'])],
      ['an owner', ({ snap }) => cardsOf(snap, /post|content/i).filter((i) => assigneesOf(i).length > 0 || Object.keys(i.fields ?? {}).some((k) => /owner/i.test(k))).length >= 8],
      ['columns idea, drafting, review, scheduled, published', ({ snap }) => boardWithColumns(snap, [/idea/i, /draft/i, /review/i, /schedul/i, /publish/i])],
      ['10 posts', ({ snap }) => atLeast(10, cardsOf(snap, /post|content/i).length, 'posts')],
    ],
  },
  {
    id: 'P5',
    level: 'hard',
    prompt: "CRM: a deal pipeline (lead, qualified, proposal, negotiation, won, lost) with Deal cards (value in GBP, close date, company, contact email, probability %), plus Company cards linked from deals. Add 6 companies and 10 deals.",
    checks: [
      ['a pipeline lead to lost', ({ snap }) => boardWithColumns(snap, [/lead/i, /qualif/i, /proposal/i, /negotiat/i, /won/i, /lost/i])],
      ['deal value in GBP', ({ snap }) => { const f = fieldOf(typeNamed(snap, /deal/i), /value|amount/i); return { pass: f?.kind === 'currency' && /gbp/i.test(f.currency ?? ''), detail: f ? `${f.kind} ${f.currency ?? ''}` : 'no value field' }; }],
      ['close date', ({ snap }) => field(snap, /deal/i, /close/i, ['date'])],
      ['contact email', ({ snap }) => field(snap, /deal/i, /email/i, ['email', 'text'])],
      ['probability %', ({ snap }) => field(snap, /deal/i, /probab/i, ['number', 'choice'])],
      ['deals link to Company cards', ({ snap }) => field(snap, /deal/i, /company/i, ['card'])],
      ['6 companies and 10 deals', ({ snap }) => ({ pass: cardsOf(snap, /company/i).length >= 6 && cardsOf(snap, /deal/i).length >= 10, detail: `${cardsOf(snap, /company/i).length} companies, ${cardsOf(snap, /deal/i).length} deals` })],
      ['each deal names its company', ({ snap }) => atLeast(10, cardsOf(snap, /deal/i).filter((d) => Object.entries(d.fields ?? {}).some(([k, v]) => /company/i.test(k) && v)).length, 'deals with a company')],
    ],
  },
  {
    id: 'P6',
    level: 'edit',
    after: 'P2',
    prompt: "Severity should also have 'blocker', drop the browser field, add a 'customer reported' checkbox, and move the critical bugs to In Progress.",
    checks: [
      ['severity has blocker', ({ snap }) => choiceHas(snap, /bug/i, /severity/i, [/blocker/i, /critical/i, /low/i])],
      ['the browser field is gone', ({ snap }) => ({ pass: !!typeNamed(snap, /bug/i) && !fieldOf(typeNamed(snap, /bug/i), /browser/i) })],
      ['a customer reported checkbox', ({ snap }) => field(snap, /bug/i, /customer/i, ['checkbox'])],
      ['every critical bug is in progress', ({ snap }) => { const crit = cardsOf(snap, /bug/i).filter((i) => Object.entries(i.fields ?? {}).some(([k, v]) => /severity/i.test(k) && /critical/i.test(String(v)))); const out = crit.filter((i) => !/progress|doing|fixing|working/i.test(i.column ?? '')); return { pass: crit.length > 0 && out.length === 0, detail: `${crit.length} critical; not moved: ${out.map((i) => `${i.ref} (${i.column})`).join(', ')}` }; }],
      ['the bugs are kept', ({ snap }) => atLeast(8, cardsOf(snap, /bug/i).length, 'bugs')],
    ],
  },
];
