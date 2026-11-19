import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { exprText, hclReferences, parseHcl, type HclBlock } from './hcl';
import { HCL_MAX_DEPTH, INFRA_MAX_FILE_BYTES } from './limits';

const body = (text: string): HclBlock => {
  const read = parseHcl(text);
  if (!read.ok) throw new Error(read.error.message);
  return read.body;
};
const errorOf = (text: string) => {
  const read = parseHcl(text);
  if (read.ok) throw new Error('expected an error');
  return read.error.message;
};

describe('parseHcl', () => {
  it('reads blocks, labels and attributes', () => {
    const root = body(
      [
        '# a comment',
        'terraform { required_version = ">= 1.5" }',
        'resource "aws_s3_bucket" "assets" {',
        '  bucket = "my-assets" // trailing',
        '  tags = {',
        '    team = "web"',
        '  }',
        '  /* a block',
        '     comment */',
        '  lifecycle_rule {',
        '    enabled = true',
        '  }',
        '}',
        'region = 1.5',
      ].join('\n'),
    );
    expect(root.blocks.map((b) => [b.type, b.labels, b.line])).toEqual([
      ['terraform', [], 2],
      ['resource', ['aws_s3_bucket', 'assets'], 3],
    ]);
    const bucket = root.blocks[1]!;
    expect([...bucket.attrs.keys()]).toEqual(['bucket', 'tags']);
    expect(bucket.blocks[0]).toMatchObject({ type: 'lifecycle_rule', line: 10 });
    expect(root.attrs.get('region')!.map((t) => t.v)).toEqual(['1.5']);
    // A one-line block's attribute ends at its `}`.
    expect(root.blocks[0]!.attrs.get('required_version')!.map((t) => t.v)).toEqual(['>= 1.5']);
  });

  it('reads identifiers as labels, escapes, literal dollars and heredocs', () => {
    const root = body(
      [
        'locals {',
        '  a = "say \\"hi\\" $${not} %%{nor}"',
        '  b = <<EOT',
        '  ${aws_iam_role.r.arn} and ${ {x = 1} }',
        'EOT',
        '  c = <<-EOT',
        '    indented',
        '    EOT',
        '  d = <<EOT',
        'left open ${',
        'EOT',
        '}',
        'dynamic ingress {',
        '}',
      ].join('\n'),
    );
    const locals = root.blocks[0]!;
    expect(locals.attrs.get('a')![0]).toMatchObject({ t: 'str', v: 'say "hi" ${not} %{nor}' });
    expect(locals.attrs.get('b')![0]!.v).toBe('  ${aws_iam_role.r.arn} and ${ {x = 1} }\n');
    expect(hclReferences(locals)).toEqual([{ kind: 'resource', type: 'aws_iam_role', name: 'r' }]);
    expect(locals.attrs.get('c')![0]!.v).toBe('    indented\n');
    expect(root.blocks[1]).toMatchObject({ type: 'dynamic', labels: ['ingress'], line: 13 });
  });

  it('reads references in interpolations, nested blocks and depends_on, once each', () => {
    const root = body(
      [
        'resource "aws_lambda_function" "api" {',
        '  role = aws_iam_role.lambda.arn',
        '  name = "${var.prefix}-${aws_s3_bucket.b.id}"',
        '  vpc_config {',
        '    subnet_ids = [aws_subnet.a.id, aws_subnet.a.arn]',
        '    nested = "${"${module.net.id}"}"',
        '  }',
        '  depends_on = [aws_iam_role.lambda, local.x, data.aws_ami.y, each.key, x.aws_vpc.z]',
        '  multi = {',
        '    a = aws_sqs_queue.q.arn',
        '  }',
        '  plain = count.index + length.of',
        '}',
      ].join('\n'),
    );
    expect(hclReferences(root.blocks[0]!)).toEqual([
      { kind: 'resource', type: 'aws_iam_role', name: 'lambda' },
      { kind: 'resource', type: 'aws_s3_bucket', name: 'b' },
      { kind: 'resource', type: 'aws_sqs_queue', name: 'q' },
      { kind: 'resource', type: 'aws_subnet', name: 'a' },
      { kind: 'module', type: 'module', name: 'net' },
    ]);
  });

  it('names each error with its line', () => {
    expect(errorOf('a = "open\nb = 1')).toBe(
      "Couldn't read the HCL: The string is not closed (line 1).",
    );
    expect(errorOf('a = "${x')).toBe(
      "Couldn't read the HCL: The interpolation is not closed (line 1).",
    );
    expect(errorOf('a = "${"x')).toBe("Couldn't read the HCL: The string is not closed (line 1).");
    expect(errorOf('a = 1\n/* never')).toBe(
      "Couldn't read the HCL: The comment is not closed (line 2).",
    );
    expect(errorOf('a = <<EOT\nbody')).toBe(
      "Couldn't read the HCL: The heredoc EOT is not closed (line 1).",
    );
    expect(errorOf('}')).toBe('Couldn\'t read the HCL: A "}" closes no block (line 1).');
    expect(errorOf('x {\n  y {\n')).toBe(
      'Couldn\'t read the HCL: The block "y" is not closed (line 2).',
    );
    expect(errorOf('resource "a" "b"\n{}')).toBe(
      'Couldn\'t read the HCL: Expected "=" or "{" after "resource" (line 1).',
    );
    expect(errorOf('= 1')).toBe('Couldn\'t read the HCL: Unexpected "=" (line 1).');
    expect(errorOf('a == b')).toMatch(/Expected "=" or "\{" after "a"/);
  });

  it('reads the edges of the text: a trailing comment, CRLF heredocs, a lone escape, a false heredoc', () => {
    expect([...body('a = 1 # no newline').attrs.keys()]).toEqual(['a']);
    expect(body('a = <<E\r\nx ${aws_vpc.v.id}\r\nE\r\n').attrs.get('a')![0]!.v).toBe(
      'x ${aws_vpc.v.id}\r\n',
    );
    expect(errorOf('a = "\\')).toMatch(/string is not closed/);
    // `<<` not followed by a marker and a newline is two characters, not a heredoc.
    expect(
      body('a = b <<EOT c\n')
        .attrs.get('a')!
        .map((t) => t.v),
    ).toEqual(['b', '<', '<', 'EOT', 'c']);
    // A heredoc interpolation that does not lex is read past; the next one still reads.
    const root = body('a = <<E\n${"x} ${aws_sqs_queue.q.id}\nE');
    expect(hclReferences(root)).toEqual([{ kind: 'resource', type: 'aws_sqs_queue', name: 'q' }]);
  });

  it('closes an interpolation at its own brace', () => {
    // The `}` of `${ {` counts as the object's, not the interpolation's.
    const root = body('a = "${ {b = aws_vpc.v.id}[0] }"\nc = 2');
    expect([...root.attrs.keys()]).toEqual(['a', 'c']);
    expect(hclReferences(root)).toEqual([{ kind: 'resource', type: 'aws_vpc', name: 'v' }]);
  });

  it('refuses an unclosed interpolation outside a string', () => {
    // A heredoc's `${` inside an interpolation reads as code, which leaves the interpolation open.
    expect(errorOf('a = "${ b')).toMatch(/not closed/);
  });

  it('caps how deep blocks nest', () => {
    const deep = `${'a {\n'.repeat(HCL_MAX_DEPTH + 1)}${'}\n'.repeat(HCL_MAX_DEPTH + 1)}`;
    expect(errorOf(deep)).toBe(
      `Couldn't read the HCL: Blocks nest too deep (line ${HCL_MAX_DEPTH + 1}).`,
    );
    const fine = `${'a {\n'.repeat(HCL_MAX_DEPTH)}${'}\n'.repeat(HCL_MAX_DEPTH)}`;
    expect(parseHcl(fine).ok).toBe(true);
  });

  it('refuses an empty or oversized file before reading it', () => {
    expect(parseHcl('\n ')).toMatchObject({ ok: false, error: { code: 'empty' } });
    expect(parseHcl('#'.repeat(INFRA_MAX_FILE_BYTES + 1))).toMatchObject({
      ok: false,
      error: { code: 'too-large' },
    });
  });

  it('quotes an attribute as written, cut short', () => {
    const root = body(
      'count = var.n * 2\nlong = "abcdefghijklmnopqrstuvwxyz0123456789abcdefgh"\nnone = 1',
    );
    expect(exprText(root.attrs.get('count'))).toBe('var.n*2');
    expect(exprText(root.attrs.get('long'))).toBe('"abcdefghijklmnopqrstuvwxyz0123456789ab…');
    expect(exprText(undefined)).toBeUndefined();
    expect(exprText([])).toBeUndefined();
    expect(exprText([{ t: 'nl', v: '\n', line: 1 }])).toBe('');
  });

  it('reads a 1 MB file of chained resources in linear time', () => {
    const lines: string[] = [];
    for (let i = 0, size = 0; size < INFRA_MAX_FILE_BYTES - 200; i++) {
      const line = `resource "aws_sqs_queue" "q${i}" {\n  redrive = aws_sqs_queue.q${i - 1}.arn\n}`;
      lines.push(line);
      size += line.length + 1;
    }
    const text = lines.join('\n');
    expect(text.length).toBeLessThanOrEqual(INFRA_MAX_FILE_BYTES);
    const ms = cpuMsOf(() => parseHcl(text));
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });

  it('reads pathological text in linear time', () => {
    const half = INFRA_MAX_FILE_BYTES / 2 - 10;
    const cases = [
      // Interpolations that open strings that open interpolations, never closed.
      `a = ${'"${'.repeat(half / 3)}`,
      // A long run of opening braces: the depth cap stops it.
      `a ${'{'.repeat(half)}`,
      // A heredoc whose end never comes, after many that do.
      `${'a = <<E\nx\nE\n'.repeat(half / 14)}b = <<NEVER\n${'x\n'.repeat(half / 4)}`,
      // Heredoc openers with nothing after them, and stray `<`s.
      `${'<<'.repeat(half / 2)}`,
      `${'/*'.repeat(half / 2)}`,
      // A heredoc full of interpolations that never close.
      `a = <<E\n${'${'.repeat(half / 2)}\nE`,
    ];
    for (const text of cases) {
      const ms = cpuMsOf(() => parseHcl(text));
      expect(ms).toBeLessThan(cpuBudgetMs(400));
    }
  });
});
