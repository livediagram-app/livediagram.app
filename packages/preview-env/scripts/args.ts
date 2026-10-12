// `--name value` pairs off argv; the CLIs take nothing else.
export function flags(argv: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`expected --name value pairs, got ${argv.join(' ')}`);
    }
    out.set(key.slice(2), value);
  }
  return out;
}

export function required(args: Map<string, string>, name: string): string {
  const value = args.get(name);
  if (value === undefined) throw new Error(`missing --${name}`);
  return value;
}
