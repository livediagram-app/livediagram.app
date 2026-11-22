// What a task's checks are written with: plain readers over a run's snapshot (the knowledgebases it touched, read
// back through the tools) and its transcript (what was called and said). A check states one requirement of the
// prompt and answers yes or no, so a round's score is a count, never an opinion. Pure: no server, no clock.

export const lc = (s) => (s ?? '').toString().toLowerCase();

function asRegex(word) {
  return word instanceof RegExp
    ? word
    : new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

// ---- what was made ------------------------------------------------------------------------------------------

// Every page of every knowledgebase the run touched, with the knowledgebase it is in.
export function pagesOf(snap) {
  return (snap.documents ?? []).flatMap((d) =>
    (d.pages ?? []).map((p) => ({ ...p, documentId: d.id })),
  );
}

// The pages whose title matches.
export function pagesTitled(snap, word) {
  const re = asRegex(word);
  return pagesOf(snap).filter((p) => re.test(p.title ?? ''));
}

// The pages directly under the first page whose title matches.
export function pagesUnder(snap, word) {
  const [parent] = pagesTitled(snap, word);
  return parent ? pagesOf(snap).filter((p) => p.parent === parent.page) : [];
}

// The titles a page's writing links to: `[[Title]]`.
export function linksOf(page) {
  return [...(page.markdown ?? '').matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
}

// ---- everything as text ---------------------------------------------------------------------------------------

// One lowercase string of every word the run made: each knowledgebase's name, each page's title and writing.
function allText(snap) {
  const out = [];
  for (const d of snap.documents ?? []) {
    out.push(d.name);
    for (const p of d.pages ?? []) out.push(p.title, p.markdown);
  }
  return lc(out.filter(Boolean).join('\n'));
}

// Every word appears somewhere in what was made.
export function mentions(snap, ...words) {
  const text = allText(snap);
  return words.every((w) => asRegex(w).test(text));
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

// ---- what was called and said ------------------------------------------------------------------------------------

// A call's tool as the transcript reader names it (transcript.mjs): the server's own name, no client prefix.
const toolOf = (call) => call.tool ?? '';

// The tools the run called, in order, successes and refusals alike.
export function toolsCalled(run) {
  return (run.calls ?? []).map(toolOf);
}

// Whether the run called a tool and it answered (a refused call does not count).
export function called(run, tool) {
  return (run.calls ?? []).some((c) => toolOf(c) === tool && !c.isError);
}

// The run's first knowledgebase tool was get_context: finding the knowledgebase may come before it.
export function contextFirst(run) {
  const [first] = toolsCalled(run).filter((t) => t !== 'find_documents');
  return {
    pass: first === 'get_context',
    detail: first ? `first tool: ${first}` : 'no tool called',
  };
}

export function replied(run, word) {
  return asRegex(word).test(run.finalText ?? '');
}

// ---- running a task's checks ---------------------------------------------------------------------------------------

// Every task's first checks: the run reached a knowledgebase, and ended with a reply.
const BASE_CHECKS = [
  ['reached a knowledgebase', ({ snap }) => (snap.documents ?? []).some((d) => !d.missing)],
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
