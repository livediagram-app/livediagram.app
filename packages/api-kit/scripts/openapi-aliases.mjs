// One step for every product api's OpenAPI generator (docs/specs/015-api/api-documentation.md): a shared generic
// type, such as element-model's ArrowElementOf<Link>, comes out of ts-json-schema-generator as a definition keyed
// `ArrowElementOf<ElementLink>`, with the product's alias (ArrowElement) only a $ref to it. OpenAPI forbids `<` and
// `>` in a component key, so each generic instance is folded into the first alias that names it, and every ref to
// it points at that alias. Plain JavaScript, so the generators run it on any Node.

const PREFIX = '#/definitions/';

const targetOf = (ref) => decodeURIComponent(ref.slice(PREFIX.length));

function rewriteRefs(value, rename) {
  if (Array.isArray(value)) return value.map((item) => rewriteRefs(item, rename));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    const target =
      key === '$ref' && typeof val === 'string' ? rename.get(targetOf(val)) : undefined;
    out[key] = target ? `${PREFIX}${target}` : rewriteRefs(val, rename);
  }
  return out;
}

/** The definitions with each generic instance folded into the alias that names it. */
export function inlineGenericAliases(definitions) {
  const rename = new Map();
  for (const [name, schema] of Object.entries(definitions)) {
    const keys = Object.keys(schema ?? {}).filter((key) => key !== 'description');
    if (keys.length !== 1 || typeof schema.$ref !== 'string') continue;
    const target = targetOf(schema.$ref);
    if (target.includes('<') && target in definitions && !rename.has(target))
      rename.set(target, name);
  }
  const out = { ...definitions };
  for (const [target, name] of rename) {
    const { description } = definitions[name];
    out[name] = description ? { ...definitions[target], description } : definitions[target];
    delete out[target];
  }
  return rename.size ? rewriteRefs(out, rename) : out;
}
