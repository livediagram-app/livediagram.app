// A Docker Compose file as a drawing (docs/specs/020-import-export/infrastructure-import.md "Docker Compose",
// blueprint "composePart"): each service a box wearing its image's icon, dependencies as arrows, named volumes as
// cylinders, and networks as groups (or hexagons, where a service sits on two).

import { composeIcon } from './compose-icons';
import { asString, PartBuilder, slug } from './part';
import { isTable, type Table } from './parse';
import type { InfraError, InfraPart } from './types';

const SILENT_TOP = new Set(['version', 'name', 'services', 'volumes', 'networks']);

// A service's runtime settings: never architecture, read past without a word. The keys drawn (depends_on, links,
// volumes, networks) are read below.
const SILENT_SERVICE = new Set([
  'image',
  'build',
  'command',
  'entrypoint',
  'environment',
  'env_file',
  'ports',
  'expose',
  'restart',
  'healthcheck',
  'container_name',
  'hostname',
  'domainname',
  'labels',
  'deploy',
  'profiles',
  'working_dir',
  'user',
  'logging',
  'ulimits',
  'cap_add',
  'cap_drop',
  'privileged',
  'read_only',
  'tty',
  'stdin_open',
  'platform',
  'init',
  'extra_hosts',
  'dns',
  'dns_search',
  'secrets',
  'configs',
  'pull_policy',
  'stop_signal',
  'stop_grace_period',
  'shm_size',
  'sysctls',
  'tmpfs',
  'devices',
  'security_opt',
  'mem_limit',
  'mem_reservation',
  'cpus',
  'cpu_shares',
  'scale',
  'external_links',
]);

const DRAWN_SERVICE = new Set(['depends_on', 'links', 'volumes', 'networks']);

const isExtension = (key: string) => key.startsWith('x-');

// The names a list of strings or a mapping's keys gives (depends_on, networks).
function namesOf(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap((x) => (asString(x) === undefined ? [] : [asString(x)!]));
  return isTable(v) ? Object.keys(v) : [];
}

// A published port as written: `8080:80`, `"443:443/tcp"`, or a long-form mapping.
function portOf(p: unknown): string | undefined {
  if (isTable(p)) {
    const published = asString(p.published);
    const target = asString(p.target);
    return published && target ? `${published}:${target}` : (target ?? published);
  }
  return asString(p);
}

// The named volume a mount uses: the short form's source before the first `:`, or the long form's `source` when its
// type is volume. Undefined for a bind mount, an anonymous volume or a malformed entry.
function volumeOf(v: unknown, named: ReadonlySet<string>): string | undefined {
  if (isTable(v)) {
    const source = asString(v.source);
    return (v.type === undefined || v.type === 'volume') && source && named.has(source)
      ? source
      : undefined;
  }
  const s = asString(v);
  if (s === undefined) return undefined;
  const colon = s.indexOf(':');
  const source = colon === -1 ? s : s.slice(0, colon);
  return named.has(source) ? source : undefined;
}

export function composePart(
  config: Table,
  fallbackName: string,
): { ok: true; part: InfraPart } | { ok: false; error: InfraError } {
  const services = config.services;
  if (!isTable(services) || Object.keys(services).length === 0)
    return {
      ok: false,
      error: { code: 'no-services', message: 'That Compose file has no services to draw.' },
    };
  const b = new PartBuilder();
  for (const key of Object.keys(config)) if (!SILENT_TOP.has(key) && !isExtension(key)) b.skip(key);

  const namedVolumes = new Set(isTable(config.volumes) ? Object.keys(config.volumes) : []);
  const ids = new Map<string, string>();
  for (const [name, raw] of Object.entries(services)) {
    const def = isTable(raw) ? raw : {};
    const image = asString(def.image);
    const ports = (Array.isArray(def.ports) ? def.ports : []).flatMap((p) => {
      const s = portOf(p);
      return s === undefined ? [] : [s];
    });
    const note = [
      ...(image ? [`image: ${image}`] : []),
      ...(ports.length ? [`ports: ${ports.join(', ')}`] : []),
    ].join('\n');
    ids.set(
      name,
      b.node({
        id: b.freeId(`svc-${slug(name)}`),
        label: name,
        icon: composeIcon(image),
        ...(note ? { note } : {}),
      }),
    );
    for (const key of Object.keys(def))
      if (!SILENT_SERVICE.has(key) && !DRAWN_SERVICE.has(key) && !isExtension(key))
        b.skip(`services.*.${key}`);
  }

  const networksOf = new Map<string, string[]>();
  for (const [name, raw] of Object.entries(services)) {
    const def = isTable(raw) ? raw : {};
    const from = ids.get(name)!;
    // A dependency naming no service is dropped (I4); `links` entries may carry an alias after `:`.
    const deps = [
      ...namesOf(def.depends_on),
      ...namesOf(def.links).map((l) => (l.includes(':') ? l.slice(0, l.indexOf(':')) : l)),
    ];
    for (const dep of deps) {
      const to = ids.get(dep);
      if (to !== undefined && to !== from) b.edge({ from, to });
    }
    for (const mount of Array.isArray(def.volumes) ? def.volumes : []) {
      const volume = volumeOf(mount, namedVolumes);
      if (volume === undefined) continue;
      const to = b.node({ id: `vol-${slug(volume)}`, label: volume, shape: 'cylinder' });
      b.edge({ from, to, line: 'dashed' });
    }
    const nets = namesOf(def.networks).filter((n) => n !== 'default');
    if (nets.length) networksOf.set(from, nets);
  }

  // One named network each: a frame per network. A service on two: a hexagon per network, joined by headless lines.
  const framed = [...networksOf.values()].every((nets) => nets.length <= 1);
  if (framed) {
    const members = new Map<string, string[]>();
    for (const [id, [net]] of networksOf) {
      const list = members.get(net!);
      if (list) list.push(id);
      else members.set(net!, [id]);
    }
    for (const [net, ids] of members)
      b.group({ id: `net-${slug(net)}`, label: `${net} network`, members: ids });
  } else {
    for (const [id, nets] of networksOf)
      for (const net of nets) {
        const to = b.node({ id: `net-${slug(net)}`, label: net, shape: 'hexagon' });
        b.edge({ from: id, to, line: 'dashed', ends: 'none' });
      }
  }
  return { ok: true, part: b.done(asString(config.name) ?? fallbackName) };
}
