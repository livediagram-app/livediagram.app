// Kubernetes manifests as a drawing (docs/specs/020-import-export/infrastructure-import.md "Kubernetes", blueprint
// "kubernetesPart"): workloads wearing their image's icon, Services joined to the workloads their selector picks,
// Ingresses to their Services, claims as cylinders, and a frame per namespace when there are several.

import { composeIcon, COMPOSE_DEFAULT_ICON } from './compose-icons';
import { asString, PartBuilder, slug } from './part';
import { isTable, type Table } from './parse';
import type { InfraError, InfraPart } from './types';

// The kinds that run pods (I9).
const WORKLOADS = new Set([
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'ReplicaSet',
  'Job',
  'CronJob',
  'Pod',
]);

// Objects that are never architecture (or are drawn as the frames): read past without a word.
const SILENT = new Set([
  'Namespace',
  'ConfigMap',
  'Secret',
  'ServiceAccount',
  'Role',
  'RoleBinding',
  'ClusterRole',
  'ClusterRoleBinding',
]);

const NO_KIND = '(document without kind)';

type K8sObject = { kind: string; name: string; ns: string; body: Table };

const tableOf = (v: unknown): Table => (isTable(v) ? v : {});
const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// A workload's pod template: its labels and its spec.
function podOf(o: K8sObject): { labels: Table; spec: Table } {
  const spec = tableOf(o.body.spec);
  const template =
    o.kind === 'Pod'
      ? o.body
      : o.kind === 'CronJob'
        ? tableOf(tableOf(tableOf(spec.jobTemplate).spec).template)
        : tableOf(spec.template);
  return {
    labels: tableOf(tableOf(template.metadata).labels),
    spec: o.kind === 'Pod' ? spec : tableOf(template.spec),
  };
}

const idOf = (kind: string, ns: string, name: string) =>
  `k8s-${slug(kind)}-${slug(ns)}-${slug(name)}`;

// Every object of the documents, `kind: List` items included, with the documents that are none counted.
function objectsOf(docs: readonly unknown[], b: PartBuilder): K8sObject[] {
  const out: K8sObject[] = [];
  const read = (doc: unknown, inList: boolean) => {
    if (doc === null || doc === undefined) return;
    const kind = isTable(doc) ? asString(doc.kind) : undefined;
    if (!isTable(doc) || kind === undefined) {
      b.skip(NO_KIND);
      return;
    }
    // A List's items, one level: a List inside a List is said, not walked.
    if (kind === 'List' && !inList) {
      for (const item of listOf(doc.items)) read(item, true);
      return;
    }
    if (SILENT.has(kind)) return;
    const meta = tableOf(doc.metadata);
    const name = asString(meta.name);
    if (name === undefined) {
      b.skip(kind);
      return;
    }
    out.push({ kind, name, ns: asString(meta.namespace) ?? 'default', body: doc });
  };
  for (const doc of docs) read(doc, false);
  return out;
}

// The Services an Ingress names: each rule path's backend and the default backend.
function ingressBackends(body: Table): string[] {
  const spec = tableOf(body.spec);
  const names: string[] = [];
  const backend = (v: unknown) => {
    const t = tableOf(v);
    const name = asString(tableOf(t.service).name) ?? asString(t.serviceName);
    if (name !== undefined && !names.includes(name)) names.push(name);
  };
  backend(spec.defaultBackend ?? spec.backend);
  for (const rule of listOf(spec.rules))
    for (const path of listOf(tableOf(tableOf(rule).http).paths)) backend(tableOf(path).backend);
  return names;
}

export function kubernetesPart(
  docs: readonly unknown[],
  fallbackName: string,
): { ok: true; part: InfraPart } | { ok: false; error: InfraError } {
  const b = new PartBuilder();
  const objects = objectsOf(docs, b);
  const nsOf = new Map<string, string>();
  const workloads: { id: string; ns: string; labels: Table; spec: Table; o: K8sObject }[] = [];
  const services: { id: string; o: K8sObject }[] = [];
  const ingresses: { id: string; o: K8sObject }[] = [];
  const claims = new Map<string, string>();
  for (const o of objects) {
    const id = idOf(o.kind, o.ns, o.name);
    if (WORKLOADS.has(o.kind)) {
      const pod = podOf(o);
      const images = listOf(pod.spec.containers).flatMap((c) => {
        const image = asString(tableOf(c).image);
        return image === undefined ? [] : [image];
      });
      const icon = composeIcon(images[0]);
      const replicas = asString(tableOf(o.body.spec).replicas);
      const note = [
        o.kind,
        ...(replicas !== undefined ? [`replicas: ${replicas}`] : []),
        ...(images.length ? [`image: ${images.join(', ')}`] : []),
      ].join('\n');
      b.node({ id, label: o.name, icon: icon === COMPOSE_DEFAULT_ICON ? 'k8s' : icon, note });
      workloads.push({ id, ns: o.ns, labels: pod.labels, spec: pod.spec, o });
    } else if (o.kind === 'Service') {
      const type = asString(tableOf(o.body.spec).type);
      b.node({ id, label: o.name, icon: 'k8s', note: type ? `Service\n${type}` : 'Service' });
      services.push({ id, o });
    } else if (o.kind === 'Ingress') {
      const hosts = listOf(tableOf(o.body.spec).rules).flatMap((r) => {
        const host = asString(tableOf(r).host);
        return host === undefined ? [] : [host];
      });
      b.node({
        id,
        label: o.name,
        shape: 'stadium',
        ...(hosts.length ? { note: `hosts: ${hosts.join(', ')}` } : {}),
      });
      ingresses.push({ id, o });
    } else if (o.kind === 'PersistentVolumeClaim') {
      b.node({ id, label: o.name, shape: 'cylinder' });
      claims.set(`${o.ns}/${o.name}`, id);
    } else {
      b.skip(o.kind);
      continue;
    }
    nsOf.set(id, o.ns);
  }

  for (const s of services) {
    const selector = tableOf(tableOf(s.o.body.spec).selector);
    const pairs = Object.entries(selector);
    if (pairs.length === 0) continue;
    for (const w of workloads)
      if (w.ns === s.o.ns && pairs.every(([k, v]) => w.labels[k] === v))
        b.edge({ from: s.id, to: w.id });
  }
  for (const ing of ingresses)
    for (const name of ingressBackends(ing.o.body)) {
      const to = services.find((s) => s.o.ns === ing.o.ns && s.o.name === name)?.id;
      if (to !== undefined) b.edge({ from: ing.id, to });
    }
  for (const w of workloads) {
    for (const v of listOf(w.spec.volumes)) {
      const claim = asString(tableOf(tableOf(v).persistentVolumeClaim).claimName);
      const to = claim === undefined ? undefined : claims.get(`${w.ns}/${claim}`);
      if (to !== undefined) b.edge({ from: w.id, to, line: 'dashed' });
    }
    if (w.o.kind !== 'StatefulSet') continue;
    for (const t of listOf(tableOf(w.o.body.spec).volumeClaimTemplates)) {
      const name = asString(tableOf(tableOf(t).metadata).name);
      if (name === undefined) continue;
      const to = b.node({
        id: `k8s-pvc-${slug(w.ns)}-${slug(name)}-${slug(w.o.name)}`,
        label: name,
        shape: 'cylinder',
      });
      nsOf.set(to, w.ns);
      b.edge({ from: w.id, to, line: 'dashed' });
    }
  }

  if (b.size === 0)
    return {
      ok: false,
      error: {
        code: 'nothing-to-draw',
        message:
          'Found no Kubernetes objects to draw: no Deployment, Service, Ingress or other workload.',
      },
    };
  // A frame per namespace, only when there are several.
  const namespaces = [...new Set(nsOf.values())];
  if (namespaces.length >= 2)
    for (const ns of namespaces)
      b.group({
        id: `ns-${slug(ns)}`,
        label: `${ns} namespace`,
        members: [...nsOf].filter(([, n]) => n === ns).map(([id]) => id),
      });
  return { ok: true, part: b.done(fallbackName) };
}
