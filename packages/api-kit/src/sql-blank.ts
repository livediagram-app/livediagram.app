// Tests only: a statement's text with every quoted string and comment blanked to a space, so a guard reading its
// tokens (d1-compound-guard.ts, d1-like-guard.ts) never counts what sits inside them. One pass with `indexOf`, never a
// backtracking pattern, so its cost stays linear in the statement's length whatever it holds.

/** `query` with each '…', "…" (a doubled quote stays inside), -- comment and block comment as one space. */
export function blankQuotedAndComments(query: string): string {
  let out = '';
  let i = 0;
  while (i < query.length) {
    const c = query[i]!;
    if (c === "'" || c === '"') {
      let end = i + 1;
      for (;;) {
        const next = query.indexOf(c, end);
        if (next === -1) {
          end = query.length;
          break;
        }
        if (query[next + 1] === c) {
          end = next + 2;
          continue;
        }
        end = next + 1;
        break;
      }
      out += ' ';
      i = end;
    } else if (c === '-' && query[i + 1] === '-') {
      const nl = query.indexOf('\n', i + 2);
      out += ' ';
      i = nl === -1 ? query.length : nl;
    } else if (c === '/' && query[i + 1] === '*') {
      const close = query.indexOf('*/', i + 2);
      out += ' ';
      i = close === -1 ? query.length : close + 2;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}
