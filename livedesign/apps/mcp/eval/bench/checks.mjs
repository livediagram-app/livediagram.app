// What a task's checks are written with: plain readers over a run's snapshot (what was made, read back through the
// tools) and its transcript (what was said). A check states one requirement of the prompt and answers yes or no, so
// a round's score is a count, never an opinion. Pure: no server, no clock.

export const lc = (s) => (s ?? '').toString().toLowerCase();

function asRegex(word) {
  return word instanceof RegExp
    ? word
    : new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

// ---- what was made ---------------------------------------------------------------------------------------------

export function tabsOf(snap) {
  return (snap.documents ?? []).flatMap((d) =>
    (d.tabs ?? []).map((t) => ({ ...t, documentId: d.id })),
  );
}

export function elementsOf(snap) {
  return tabsOf(snap).flatMap((t) => t.elements.map((e) => ({ ...e, tabId: t.id })));
}

// Every piece of words an element carries: a label, a sticky's or a text's text, a table's cells, a code block.
export function wordsOf(el) {
  const parts = [el.label, el.text, el.title, el.note, el.name, el.subtitle];
  if (Array.isArray(el.rows)) parts.push(...el.rows.flat(2));
  if (Array.isArray(el.columns))
    parts.push(...el.columns.map((c) => (typeof c === 'string' ? c : c?.name)));
  if (Array.isArray(el.attributes))
    parts.push(...el.attributes.map((a) => (typeof a === 'string' ? a : a?.name)));
  if (Array.isArray(el.data)) parts.push(...el.data.map((d) => d?.label ?? d?.name));
  if (Array.isArray(el.pieSlices)) parts.push(...el.pieSlices.map((d) => d?.label));
  if (Array.isArray(el.lineCategories)) parts.push(...el.lineCategories);
  if (Array.isArray(el.lineSeries)) parts.push(...el.lineSeries.map((d) => d?.name));
  return parts.filter((p) => typeof p === 'string' && p.trim()).join(' ');
}

// The elements whose words match.
export function find(snap, word) {
  const re = asRegex(word);
  return elementsOf(snap).filter((e) => re.test(wordsOf(e)));
}

// A tab's pages, from its pages view: `page 2 "Tip 2" page-99 · wireframe iPhone · at … · 16 elements`
// (a logo page adds `· background #fff` before its count).
// A page line's rectangle on the canvas: `at -960,-540 1920x1080`.
function rectOf(line) {
  const r = / · at (-?[\d.]+),(-?[\d.]+) ([\d.]+)x([\d.]+)/.exec(line);
  return r ? { x: Number(r[1]), y: Number(r[2]), width: Number(r[3]), height: Number(r[4]) } : {};
}

export function pagesOf(snap) {
  const out = [];
  for (const t of tabsOf(snap)) {
    for (const line of (t.pages ?? '').split('\n')) {
      const m =
        /^page (\d+)(?: "([^"]*)")? \S+ · ([\w-]+) ([^·]+?) · at .*?· (\d+) elements?$/.exec(line);
      if (m)
        out.push({
          tabId: t.id,
          n: Number(m[1]),
          name: m[2] ?? null,
          kind: m[3],
          format: m[4].trim(),
          ...rectOf(line),
          elements: m[5] === undefined ? null : Number(m[5]),
        });
    }
  }
  return out;
}

// ---- everything as text ---------------------------------------------------------------------------------------

// One lowercase string of every word the run made, wherever it sits (elements, pages).
function allText(snap) {
  const out = [];
  for (const d of snap.documents ?? []) {
    out.push(d.name);
    for (const t of d.tabs ?? []) {
      out.push(t.name, ...t.elements.map(wordsOf));
      if (t.pages) out.push(t.pages);
    }
  }
  return lc(out.filter(Boolean).join('\n'));
}

// ---- checks with a reason --------------------------------------------------------------------------------------

const show = (w) => (w instanceof RegExp ? w.source : w);

// Every word appears in what was made; the detail names the missing.
export function mentionsAll(snap, words) {
  const text = allText(snap);
  const missing = words.filter((w) => !asRegex(w).test(text));
  return {
    pass: missing.length === 0,
    detail: missing.length ? `missing: ${missing.map(show).join(', ')}` : null,
  };
}

export function atLeast(n, have, what) {
  return { pass: have >= n, detail: have >= n ? null : `${have} ${what}, wanted ${n}+` };
}

// ---- running a task's checks ---------------------------------------------------------------------------------------

// Every task's first check: the run made or changed something, and ended with a reply.
const BASE_CHECKS = [
  ['made something', ({ snap }) => (snap.documents ?? []).some((d) => !d.missing)],
  ['replied', ({ run }) => (run.finalText ?? '').trim().length > 0],
];

export function runChecks(task, ctx) {
  const all = [...BASE_CHECKS, ...(task.checks ?? [])];
  return all.map(([name, fn]) => {
    try {
      const got = fn(ctx);
      if (typeof got === 'object' && got !== null)
        return { name, pass: !!got.pass, detail: got.detail ?? null };
      return { name, pass: !!got, detail: null };
    } catch (err) {
      return { name, pass: false, detail: `check threw: ${err?.message ?? err}` };
    }
  });
}
