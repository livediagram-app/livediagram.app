import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The photo session is a mutable object (lib/photo-editor/session.ts): a component that reads it as it renders
// and is left to the React Compiler keeps what it read the first time (the Layers tab's controls once never
// showed). Each such component opts out with 'use no memo' and re-renders on the session's version.
const dir = __dirname;
const READS_SESSION =
  /\bsession\b[!?]?\.(?:photo|active|target|selection|chosen|layer|solo|lastSelection|pageId)\b|\bs\.(?:photo|active|target|selection|chosen|layer|solo)\b/;

describe('the photo components', () => {
  it('that read the session as they render opt out of the compiler’s memo', () => {
    const missing = readdirSync(dir)
      .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
      .filter((f) => {
        const src = readFileSync(join(dir, f), 'utf8');
        return READS_SESSION.test(src) && !src.includes("'use no memo'");
      });
    expect(missing).toEqual([]);
  });
});
