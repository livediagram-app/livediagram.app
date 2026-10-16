// What a task's checks are written with: plain readers over a run's snapshot (what was made, read back through the
// tools) and its transcript (what was said). A check states one requirement of the prompt and answers yes or no, so
// a round's score is a count, never an opinion. Pure: no server, no clock.

// Shapes that hold a node's words; frames, key swatches and the like are containers or decoration.
const DECOR_SHAPES = new Set(['frame', 'plan-board', 'plan-sheet', 'lane', 'pool']);

export const lc = (s) => (s ?? '').toString().toLowerCase();

function asRegex(word) {
  return word instanceof RegExp
    ? word
    : new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

// ---- diagrams -----------------------------------------------------------------------------------------------

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
  if (Array.isArray(el.entityFields))
    parts.push(...el.entityFields.flatMap((f) => [f?.name, f?.type]));
  if (Array.isArray(el.pieSlices)) parts.push(...el.pieSlices.map((d) => d?.label));
  if (Array.isArray(el.lineCategories)) parts.push(...el.lineCategories);
  if (Array.isArray(el.lineSeries)) parts.push(...el.lineSeries.map((d) => d?.name));
  return parts.filter((p) => typeof p === 'string' && p.trim()).join(' ');
}

// The labelled boxes on the tabs: shapes that are not containers, with words.
export function boxes(snap) {
  return elementsOf(snap).filter(
    (e) => e.type === 'shape' && !DECOR_SHAPES.has(e.shape) && wordsOf(e),
  );
}

export function arrows(snap) {
  return elementsOf(snap).filter(
    (e) => e.type === 'arrow' || e.type === 'line' || e.type === 'connector',
  );
}

const endId = (end) => end?.elementId ?? end?.id ?? null;

// The boxes whose words match.
export function find(snap, word) {
  const re = asRegex(word);
  return elementsOf(snap).filter((e) => re.test(wordsOf(e)));
}

// An arrow joins something matching `a` to something matching `b` (either way round unless `directed`).
export function linked(snap, a, b, { directed = false } = {}) {
  const as = new Set(find(snap, a).map((e) => e.id));
  const bs = new Set(find(snap, b).map((e) => e.id));
  return arrows(snap).some((x) => {
    const f = endId(x.from);
    const t = endId(x.to);
    return (as.has(f) && bs.has(t)) || (!directed && as.has(t) && bs.has(f));
  });
}

// An arrow runs from something matching `a` to something matching `b`.
export function flows(snap, a, b) {
  return linked(snap, a, b, { directed: true });
}

// Elements of one kind: a shape name ("lane", "entity", "bar-chart") or an element type ("sticky", "arrow").
export function shapes(snap, kind) {
  return elementsOf(snap).filter((e) => e.shape === kind || (e.type === kind && !e.shape));
}

// Something matching `word` sits inside a frame or lane whose words match `group`: by bounds, or by its parent.
export function inside(snap, word, group) {
  const groups = find(snap, group).filter(
    (g) => g.type === 'shape' && (DECOR_SHAPES.has(g.shape) || g.width),
  );
  return find(snap, word).some((e) =>
    groups.some(
      (g) =>
        g.id !== e.id &&
        (e.parentId === g.id ||
          e.frameId === g.id ||
          (e.x >= g.x &&
            e.y >= g.y &&
            e.x + (e.width ?? 0) <= g.x + g.width &&
            e.y + (e.height ?? 0) <= g.y + g.height)),
    ),
  );
}

// An Illustrate tab's pages, from its pages view: `page 2 "Tip 2" page-99 · infographic Square · at … · 16 elements`
// (a logo page adds `· background #fff` before its count; an article page ends `· article art-1 · its writing below`).
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
        /^page (\d+)(?: "([^"]*)")? \S+ · ([\w-]+) ([^·]+?) · at .*?(?:· (\d+) elements?|· article .*)$/.exec(
          line,
        );
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

// The tab is drawn hand-made: a Draw tab, or a sketch finish.
export function sketched(tab) {
  return /finish=sketch|mode=draw/.test(tab.outline?.split('\n')[0] ?? '');
}

// ---- everything as text ---------------------------------------------------------------------------------------

function sheetText(sheet) {
  return (sheet.read?.cells ?? []).map((c) => c.display ?? c.input).join(' ');
}

// One lowercase string of every word the run made, wherever it sits (elements, cards, sheets, forms, pages).
export function allText(snap) {
  const out = [];
  for (const d of snap.documents ?? []) {
    out.push(d.name);
    for (const t of d.tabs ?? []) {
      out.push(t.name, ...t.elements.map(wordsOf));
      if (t.form) out.push(JSON.stringify(t.form));
      if (t.pages) out.push(t.pages);
    }
    for (const it of d.items?.items ?? []) out.push(it.title, JSON.stringify(it.fields ?? {}));
    for (const b of d.items?.boards ?? [])
      out.push(b.title, ...(b.columns ?? []).map((c) => c.name));
    for (const s of d.sheets ?? []) out.push(s.title, sheetText(s));
  }
  return lc(out.filter(Boolean).join('\n'));
}

// Every word appears somewhere in what was made.
export function mentions(snap, ...words) {
  const text = allText(snap);
  return words.every((w) => asRegex(w).test(text));
}

// ---- plan ---------------------------------------------------------------------------------------------------------

export function itemsOf(snap) {
  return (snap.documents ?? []).flatMap((d) => d.items?.items ?? []);
}

export function boardsOf(snap) {
  return (snap.documents ?? []).flatMap((d) => d.items?.boards ?? []);
}

export function typesOf(snap) {
  return (snap.documents ?? []).flatMap((d) => d.items?.types ?? []);
}

// A card type (by name) and its custom fields' names, lowercase.
export function typeNamed(snap, word) {
  const re = asRegex(word);
  return typesOf(snap).find((t) => re.test(t.name)) ?? null;
}

export function customFieldNames(type) {
  return (type?.custom ?? []).map((f) => lc(f.name));
}

export function hasField(type, word) {
  const re = asRegex(word);
  return (type?.custom ?? []).some((f) => re.test(f.name));
}

export function fieldOf(type, word) {
  const re = asRegex(word);
  return (type?.custom ?? []).find((f) => re.test(f.name)) ?? null;
}

// A card's people, from its assignee field (one or many).
export function assigneesOf(item) {
  const a = item.fields?.assignee ?? item.fields?.assignees;
  const list = Array.isArray(a) ? a : a ? [a] : [];
  return list.map((p) => lc(p?.name ?? p));
}

export function columnNames(board) {
  return (board?.columns ?? []).map((c) => lc(c.name));
}

// ---- sheets -------------------------------------------------------------------------------------------------------

export function sheetsOf(snap) {
  return (snap.documents ?? []).flatMap((d) => d.sheets ?? []);
}

// A sheet's cells as read_sheet answers them: [{at: "B4", input, value, display}].
export function cellsOf(sheet) {
  return sheet.read?.cells ?? [];
}

export function formulasOf(sheet) {
  return cellsOf(sheet).filter((c) => typeof c.input === 'string' && c.input.startsWith('='));
}

export function allFormulas(snap) {
  return sheetsOf(snap).flatMap(formulasOf);
}

// Cells whose worked-out value is a spreadsheet error (#REF!, #DIV/0!, #NAME?, #VALUE!, #N/A, #CYCLE!).
export function errorCells(snap) {
  return sheetsOf(snap)
    .flatMap(cellsOf)
    .filter((c) => typeof c.value === 'string' && /^#[A-Z/0!?]+/.test(c.value));
}

export function validationsOf(snap) {
  return sheetsOf(snap).flatMap((s) => s.read?.validation ?? []);
}

export function conditionalFormatsOf(snap) {
  return sheetsOf(snap).flatMap((s) => s.read?.conditionalFormats ?? []);
}

const colOf = (at) => /^[A-Z]+/.exec(at)?.[0] ?? '';
const rowOf = (at) => Number(/\d+$/.exec(at)?.[0] ?? 0);

// The header cell whose text matches, on any sheet: {sheet, at, col, row}.
export function header(snap, word) {
  const re = asRegex(word);
  for (const sheet of sheetsOf(snap))
    for (const c of cellsOf(sheet))
      if (
        typeof c.input === 'string' &&
        !c.input.startsWith('=') &&
        re.test(c.input) &&
        c.input.length <= 40
      )
        return { sheet, at: c.at, col: colOf(c.at), row: rowOf(c.at) };
  return null;
}

// The cells under a header, down its column, to the first gap.
export function below(found) {
  if (!found) return [];
  const byAt = new Map(cellsOf(found.sheet).map((c) => [c.at, c]));
  const out = [];
  for (let r = found.row + 1; byAt.has(`${found.col}${r}`); r++)
    out.push(byAt.get(`${found.col}${r}`));
  return out;
}

// ---- forms ------------------------------------------------------------------------------------------------------

export function formsOf(snap) {
  return tabsOf(snap)
    .map((t) => t.form)
    .filter(Boolean);
}

export function questionsOf(form) {
  return (form?.sections ?? []).flatMap((s) => s.questions ?? []);
}

// The question about something: by its wording, else by the field its answer goes to ("How severe is it?" → Severity).
export function questionAbout(form, word) {
  const re = asRegex(word);
  const qs = questionsOf(form);
  return qs.find((q) => re.test(q.prompt ?? '')) ?? qs.find((q) => re.test(q.goesTo ?? '')) ?? null;
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

// Every word has an element of its own (a box, a sticky, an entity, a lane) holding it.
export function elementsFor(snap, words) {
  const missing = words.filter((w) => find(snap, w).length === 0);
  return {
    pass: missing.length === 0,
    detail: missing.length ? `no element for: ${missing.map(show).join(', ')}` : null,
  };
}

// Every pair is joined by an arrow ([a, b] directed a to b when `directed`).
export function allLinked(snap, pairs, { directed = false } = {}) {
  const missing = pairs.filter(([a, b]) => !linked(snap, a, b, { directed }));
  return {
    pass: missing.length === 0,
    detail: missing.length
      ? `not joined: ${missing.map(([a, b]) => `${show(a)} ${directed ? '→' : '–'} ${show(b)}`).join(', ')}`
      : null,
  };
}

export function atLeast(n, have, what) {
  return { pass: have >= n, detail: have >= n ? null : `${have} ${what}, wanted ${n}+` };
}

// ---- the reply ---------------------------------------------------------------------------------------------------

export function replied(run, word) {
  return asRegex(word).test(run.finalText ?? '');
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
