// The sheets tasks of the benchmark (docs/instructions/evaluate-mcp-output.md). Each prompt is what a user would type;
// `checks` judge what the run made from the prompt's own requirements (see checks.mjs).
import {
  allFormulas,
  atLeast,
  below,
  conditionalFormatsOf,
  errorCells,
  header,
  mentionsAll,
  sheetsOf,
  validationsOf,
} from '../checks.mjs';

const formulasMatching = (snap, re) => allFormulas(snap).filter((c) => re.test(c.input));
const noErrors = ['no cell shows an error', ({ snap }) => { const bad = errorCells(snap); return { pass: sheetsOf(snap).length > 0 && bad.length === 0, detail: bad.length ? bad.slice(0, 5).map((c) => `${c.at} ${c.value}`).join(', ') : null }; }];
const dropdownFor = (snap, word) => {
  const h = header(snap, word);
  const ok = !!h && validationsOf(snap).some((v) => v.type === 'dropdown' && new RegExp(`^\\$?${h.col}\\$?\\d`).test(v.range));
  return { pass: ok, detail: ok ? null : h ? `no dropdown on column ${h.col}` : `no ${word.source} header` };
};
const numbers = (cells) => cells.map((c) => c.value).filter((v) => typeof v === 'number');

export default [
  {
    id: 'S1',
    level: 'easy',
    prompt: "Monthly household budget sheet: income and expense categories, planned vs actual, differences and totals.",
    checks: [
      ['planned and actual columns', ({ snap }) => ({ pass: !!header(snap, /planned|budget/i) && !!header(snap, /actual/i) })],
      ['income and expenses', ({ snap }) => mentionsAll(snap, [/income/i, /expense/i])],
      ['expense categories', ({ snap }) => mentionsAll(snap, [/rent|mortgage|housing/i, /food|groceries/i, /utilit|energy|bills/i, /transport|car/i])],
      ['differences worked out', ({ snap }) => atLeast(5, formulasMatching(snap, /[A-Z]+\d+\s*-\s*[A-Z]+\d+/).length, 'difference formulas')],
      ['totals worked out', ({ snap }) => atLeast(2, formulasMatching(snap, /SUM\(/i).length, 'SUM formulas')],
      noErrors,
    ],
  },
  {
    id: 'S2',
    level: 'medium',
    prompt: "Sales tracker: 20 rows of deals with rep, region dropdown, amount, stage dropdown, close date; totals by region; highlight deals over 50k.",
    checks: [
      ['20 deals', ({ snap }) => atLeast(20, below(header(snap, /^rep\b|sales ?rep/i)).length, 'rows under Rep')],
      ['rep, amount and close date columns', ({ snap }) => ({ pass: !!header(snap, /^rep\b|sales ?rep/i) && !!header(snap, /amount|value/i) && !!header(snap, /close/i) })],
      ['region is a dropdown', ({ snap }) => dropdownFor(snap, /^region$/i)],
      ['stage is a dropdown', ({ snap }) => dropdownFor(snap, /^stage$/i)],
      ['totals by region', ({ snap }) => atLeast(3, formulasMatching(snap, /SUMIFS?\(|FILTER\(|QUERY\(/i).length, 'per-region formulas')],
      ['deals over 50k highlighted', ({ snap }) => ({ pass: conditionalFormatsOf(snap).some((f) => /50,?000|50k/i.test(f.rule ?? '')), detail: conditionalFormatsOf(snap).map((f) => f.rule).join('; ') || 'no conditional formats' })],
      noErrors,
    ],
  },
  {
    id: 'S3',
    level: 'medium',
    prompt: "Loan calculator: amount, rate, term inputs, monthly payment formula and an amortisation schedule for the first 12 months.",
    checks: [
      ['amount, rate and term inputs', ({ snap }) => mentionsAll(snap, [/amount|principal/i, /rate/i, /term|years|months/i])],
      ['the monthly payment is a formula', ({ snap }) => atLeast(1, formulasMatching(snap, /PMT\(|\^|POWER\(/i).length, 'payment formulas')],
      ['12 months of amortisation', ({ snap }) => atLeast(12, numbers(below(header(snap, /balance/i))).length, 'balance rows')],
      ['interest and principal per month', ({ snap }) => ({ pass: !!header(snap, /interest/i) && !!header(snap, /principal/i) })],
      ['the schedule is formulas, not typed numbers', ({ snap }) => atLeast(24, allFormulas(snap).length, 'formulas')],
      ['the balance goes down', ({ snap }) => { const v = numbers(below(header(snap, /balance/i))); return { pass: v.length >= 2 && v.every((x, i) => i === 0 || x <= v[i - 1]) && v.at(-1) < v[0], detail: v.slice(0, 3).join(', ') }; }],
      noErrors,
    ],
  },
  {
    id: 'S4',
    level: 'hard',
    prompt: "Grade book for 12 students over 5 assignments with weights, weighted average, letter grade by formula, class average and a fail highlight.",
    checks: [
      ['12 students', ({ snap }) => atLeast(12, below(header(snap, /student|name/i)).length, 'students')],
      ['5 assignments with weights', ({ snap }) => mentionsAll(snap, [/weight/i])],
      ['a weighted average by formula', ({ snap }) => atLeast(12, formulasMatching(snap, /SUMPRODUCT\(|\*/i).length, 'weighted formulas')],
      ['a letter grade by formula', ({ snap }) => atLeast(12, formulasMatching(snap, /IFS?\(|LOOKUP\(|CHOOSE\(|SWITCH\(/i).length, 'grade formulas')],
      ['a class average', ({ snap }) => atLeast(1, formulasMatching(snap, /AVERAGE\(/i).length, 'AVERAGE formulas')],
      ['fails highlighted', ({ snap }) => ({ pass: conditionalFormatsOf(snap).length > 0, detail: 'no conditional formats' })],
      noErrors,
    ],
  },
  {
    id: 'S5',
    level: 'edit',
    after: 'S2',
    prompt: "Sort by amount descending, freeze the header, and add a commission column at 8%.",
    checks: [
      ['sorted by amount, largest first', ({ snap }) => { const v = numbers(below(header(snap, /amount|value/i))); return { pass: v.length >= 20 && v.slice(0, 20).every((x, i) => i === 0 || x <= v[i - 1]), detail: v.slice(0, 6).join(', ') }; }],
      ['the header is frozen', ({ snap }) => { const h = header(snap, /amount|value/i); return { pass: !!h && sheetsOf(snap).some((s) => (s.read?.frozen?.rows ?? 0) >= h.row), detail: `frozen ${sheetsOf(snap).map((s) => s.read?.frozen?.rows ?? 0).join(',')}, header row ${h?.row}` }; }],
      ['a commission column at 8%', ({ snap }) => ({ pass: !!header(snap, /commission/i) && atLeast(20, formulasMatching(snap, /0?\.08|8%|\$[A-Z]+\$\d+/).length, '').pass, detail: `${formulasMatching(snap, /0?\.08|8%/).length} 8% formulas` })],
      ['still 20 deals', ({ snap }) => atLeast(20, below(header(snap, /^rep\b|sales ?rep/i)).length, 'rows under Rep')],
      ['region and stage still dropdowns', ({ snap }) => ({ pass: dropdownFor(snap, /^region$/i).pass && dropdownFor(snap, /^stage$/i).pass })],
      noErrors,
    ],
  },
];
