import { describe, expect, it } from 'vitest';
import { runInlineScript } from './inline-script.js';

// docs/specs/003-system-architecture/testing.md "An inline script is tested as the browser runs it".

describe('runInlineScript', () => {
  it('runs the source with the stubs it is handed as its globals', () => {
    const classes = [];
    const document = { documentElement: { classList: { add: (c) => classes.push(c) } } };
    runInlineScript("document.documentElement.classList.add('dark');", { document });
    expect(classes).toEqual(['dark']);
  });

  it("gives the script the language built-ins, but none of the host's: no process, no timers", () => {
    const seen = {};
    runInlineScript(
      'seen.json = JSON.stringify({ a: 1 }); seen.process = typeof process; seen.timer = typeof setTimeout;',
      { seen },
    );
    expect(seen).toEqual({ json: '{"a":1}', process: 'undefined', timer: 'undefined' });
  });

  it('keeps top-level declarations out of the test realm and the stubs object', () => {
    const globals = { document: {} };
    runInlineScript('var leaked = 1; function alsoLeaked() {}', globals);
    expect(globalThis).not.toHaveProperty('leaked');
    expect(globals).toEqual({ document: {} });
  });

  it('lets a stub shadow a built-in, such as a clock', () => {
    const seen = {};
    runInlineScript('seen.now = Date.now();', { seen, Date: { now: () => 42 } });
    expect(seen.now).toBe(42);
  });

  it('throws what the script throws', () => {
    expect(() => runInlineScript("throw new Error('boom');")).toThrow('boom');
  });
});
