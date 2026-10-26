// Tests only: every D1 and Durable Object SQLite stand-in calls this on each statement it prepares. D1 caps a compound
// SELECT at five terms where node:sqlite allows 500, so a query that passes a test could fail in production. Refuse it
// the way D1 does: count UNION / INTERSECT / EXCEPT at each level of parentheses, per statement, ignoring what sits
// in quotes and comments. No Worker imports this module.
import { D1_COMPOUND_MAX } from './d1-compound';

const QUOTED = /'(?:[^']|'')*'|"(?:[^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\//g;
const COMPOUND = /\(|\)|;|\b(?:UNION(?:\s+ALL)?|INTERSECT|EXCEPT)\b/gi;

export function assertD1Compound(query: string, max = D1_COMPOUND_MAX): void {
  let counts = [0];
  for (const [token] of query.replace(QUOTED, ' ').matchAll(COMPOUND)) {
    if (token === '(') counts.push(0);
    else if (token === ')') counts.pop();
    else if (token === ';') counts = [0];
    else if (++counts[counts.length - 1]! + 1 > max) {
      throw new Error('D1_ERROR: too many terms in compound SELECT: SQLITE_ERROR');
    }
  }
}
