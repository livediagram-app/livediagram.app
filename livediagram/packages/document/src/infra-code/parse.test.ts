import { describe, expect, it } from 'vitest';
import { INFRA_MAX_FILE_BYTES } from './limits';
import { isTable, parseError, parseInfraText, parseKubernetesText } from './parse';

describe('parseInfraText', () => {
  it('parses TOML and YAML into plain objects', () => {
    expect(parseInfraText('wrangler', 'name = "api"\n[ai]\nbinding = "AI"')).toEqual({
      ok: true,
      value: { name: 'api', ai: { binding: 'AI' } },
    });
    expect(
      parseInfraText(
        'compose',
        'x-base: &base\n  image: redis\nservices:\n  cache:\n    <<: *base',
      ),
    ).toEqual({
      ok: true,
      value: { 'x-base': { image: 'redis' }, services: { cache: { image: 'redis' } } },
    });
  });

  it('keeps the later of a YAML key given twice', () => {
    const read = parseInfraText('compose', 'services:\n  a: {}\nservices:\n  b: {}');
    expect(read).toEqual({ ok: true, value: { services: { b: {} } } });
  });

  it('names a parse error with its line', () => {
    const toml = parseInfraText('wrangler', 'name = "api"\n\nmain = \n');
    expect(toml.ok).toBe(false);
    if (!toml.ok) {
      expect(toml.error.code).toBe('parse');
      expect(toml.error.message).toMatch(/^Couldn't read the TOML: .+ \(line 3\)\.$/);
    }
    const yaml = parseInfraText('compose', 'services:\n  web:\n    image: [a\n');
    expect(yaml.ok).toBe(false);
    if (!yaml.ok) expect(yaml.error.message).toMatch(/^Couldn't read the YAML: .+ \(line \d+\)\.$/);
    // js-yaml places an unclosed flow collection a line past the end: the message names the last line.
    const open = parseInfraText('compose', 'services: [');
    if (!open.ok) expect(open.error.message).toMatch(/\(line 1\)\.$/);
    expect(open.ok).toBe(false);
  });

  it('refuses an empty, an oversized or a keyless file', () => {
    expect(parseInfraText('wrangler', '  \n')).toMatchObject({
      ok: false,
      error: { code: 'empty' },
    });
    expect(parseInfraText('compose', 'a'.repeat(INFRA_MAX_FILE_BYTES + 1))).toMatchObject({
      ok: false,
      error: { code: 'too-large' },
    });
    expect(parseInfraText('compose', '- a\n- b')).toMatchObject({
      ok: false,
      error: { code: 'not-a-table' },
    });
    expect(parseInfraText('compose', 'just text')).toMatchObject({
      ok: false,
      error: { code: 'not-a-table' },
    });
  });

  it('words an error the parser gave without a line or a message', () => {
    expect(parseError('compose', { message: 'bad thing:' }).message).toBe(
      "Couldn't read the YAML: bad thing.",
    );
    expect(parseError('wrangler', 'plain failure').message).toBe(
      "Couldn't read the TOML: plain failure.",
    );
  });

  it('builds no functions from YAML tags (the safe schema)', () => {
    const read = parseInfraText('compose', 'a: !!js/function "function () {}"');
    expect(read.ok).toBe(false);
  });

  it('reads every document of a Kubernetes file, empty ones as null', () => {
    expect(parseKubernetesText('kind: A\n---\n---\nkind: B')).toEqual({
      ok: true,
      docs: [{ kind: 'A' }, null, { kind: 'B' }],
    });
    const bad = parseKubernetesText('kind: A\n---\nkind: [');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.message).toMatch(/^Couldn't read the YAML: .+ \(line \d+\)\.$/);
    expect(parseKubernetesText(' ')).toMatchObject({ ok: false, error: { code: 'empty' } });
  });

  it('tells a table from a list or a scalar', () => {
    expect(isTable({})).toBe(true);
    expect(isTable([])).toBe(false);
    expect(isTable(null)).toBe(false);
    expect(isTable('x')).toBe(false);
  });
});
