// Terraform files as a drawing (docs/specs/020-import-export/infrastructure-import.md "Terraform", blueprint
// "terraformPart"): each resource and module a box, each reference one names an arrow to it, and the joining
// resources (attachments, associations) dashed lines between the two they join.

import { exprText, hclReferences, type HclBlock, type HclReference } from './hcl';
import { PartBuilder, slug } from './part';
import { terraformIcon } from './terraform-icons';
import type { InfraError, InfraPart } from './types';

// Blocks that are never architecture: read past without a word.
const SILENT = new Set([
  'terraform',
  'provider',
  'variable',
  'output',
  'locals',
  'moved',
  'import',
  'removed',
  'check',
]);

// A resource that relates two others rather than being a thing of its own.
const isJoining = (type: string) => type.endsWith('_attachment') || type.endsWith('_association');

const resourceId = (type: string, name: string) => `tf-${slug(type)}-${slug(name)}`;
const moduleId = (name: string) => `tf-module-${slug(name)}`;
const refId = (ref: HclReference) =>
  ref.kind === 'module' ? moduleId(ref.name) : resourceId(ref.type, ref.name);

// A module's `source`, when it is a plain string.
function sourceOf(block: HclBlock): string | undefined {
  const tokens = block.attrs.get('source');
  return tokens && tokens.length === 1 && tokens[0]!.t === 'str' ? tokens[0]!.v : undefined;
}

export function terraformPart(
  body: HclBlock,
  fallbackName: string,
): { ok: true; part: InfraPart } | { ok: false; error: InfraError } {
  const b = new PartBuilder();
  for (const key of body.attrs.keys()) b.skip(key);
  // Each drawn block with the id of its box; joining resources apart.
  const drawn: { id: string; block: HclBlock }[] = [];
  const joining: HclBlock[] = [];
  for (const block of body.blocks) {
    if (SILENT.has(block.type)) continue;
    if (block.type === 'resource' && block.labels.length === 2) {
      const [type, name] = block.labels as [string, string];
      if (isJoining(type)) {
        joining.push(block);
        continue;
      }
      const count = exprText(block.attrs.get('count'));
      const note = [
        type,
        ...(count !== undefined ? [`count: ${count}`] : []),
        ...(block.attrs.has('for_each') ? ['for_each'] : []),
      ].join('\n');
      const id = b.node({
        id: resourceId(type, name),
        label: name,
        icon: terraformIcon(type),
        note,
      });
      drawn.push({ id, block });
      continue;
    }
    if (block.type === 'module' && block.labels.length === 1) {
      const name = block.labels[0]!;
      const source = sourceOf(block);
      const id = b.node({
        id: moduleId(name),
        label: name,
        icon: 'terraform',
        ...(source ? { note: `module: ${source}` } : {}),
      });
      drawn.push({ id, block });
      continue;
    }
    if (block.type === 'data') {
      b.skip(`data.${block.labels[0] ?? 'x'}`);
      continue;
    }
    b.skip(block.labels[0] && block.type === 'resource' ? block.labels[0] : block.type);
  }
  const declared = new Set(drawn.map((d) => d.id));
  for (const { id, block } of drawn)
    for (const ref of hclReferences(block)) {
      const to = refId(ref);
      if (to !== id && declared.has(to)) b.edge({ from: id, to });
    }
  for (const block of joining) {
    const ends = hclReferences(block)
      .map(refId)
      .filter((id) => declared.has(id));
    if (ends.length < 2) b.skip(`resource.${block.labels[0]}`);
    else b.edge({ from: ends[0]!, to: ends[1]!, line: 'dashed' });
  }
  if (b.size === 0)
    return {
      ok: false,
      error: { code: 'nothing-to-draw', message: 'Found no resource or module to draw.' },
    };
  return { ok: true, part: b.done(fallbackName) };
}
