import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { kubernetesPart } from './kubernetes';
import { parseKubernetesText } from './parse';

const draw = (text: string) => {
  const read = parseKubernetesText(text);
  if (!read.ok) throw new Error(read.error.message);
  return kubernetesPart(read.docs, 'k8s');
};
const part = (text: string) => {
  const built = draw(text);
  if (!built.ok) throw new Error(built.error.message);
  return built.part;
};

const SHOP = `
apiVersion: apps/v1
kind: Deployment
metadata: { name: web }
spec:
  replicas: 3
  template:
    metadata: { labels: { app: web, tier: front } }
    spec:
      containers:
        - { name: web, image: nginx:1.27 }
        - { name: side, image: acme/sidecar }
      volumes:
        - name: data
          persistentVolumeClaim: { claimName: uploads }
        - name: other
          persistentVolumeClaim: { claimName: missing }
        - name: tmp
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata: { name: web }
spec:
  type: ClusterIP
  selector: { app: web }
---
apiVersion: v1
kind: Service
metadata: { name: headless }
spec: {}
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata: { name: public }
spec:
  defaultBackend: { service: { name: web } }
  rules:
    - host: shop.example
      http:
        paths:
          - backend: { serviceName: web }
          - backend: { service: { name: nowhere } }
    - http: {}
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: uploads }
---
apiVersion: apps/v1
kind: StatefulSet
metadata: { name: db }
spec:
  template:
    metadata: { labels: { app: db } }
    spec:
      containers: [{ name: pg, image: postgres:16 }]
  volumeClaimTemplates:
    - metadata: { name: pgdata }
    - metadata: {}
---
apiVersion: batch/v1
kind: CronJob
metadata: { name: nightly }
spec:
  jobTemplate:
    spec:
      template:
        metadata: { labels: { app: web } }
        spec:
          containers: [{ name: job, image: acme/report }]
---
kind: Pod
metadata: { name: debug }
spec:
  containers: [{ name: sh }]
---
kind: ConfigMap
metadata: { name: settings }
---
kind: HorizontalPodAutoscaler
metadata: { name: web }
---
kind: Deployment
metadata: {}
---
- just a list
---
---
kind: List
items:
  - kind: Secret
    metadata: { name: s }
  - kind: Service
    metadata: { name: listed }
  - kind: List
    items: []
`;

describe('kubernetesPart', () => {
  it('draws workloads, Services, Ingresses and claims', () => {
    const p = part(SHOP);
    expect(p.title).toBe('k8s');
    expect(p.nodes.map((n) => [n.id, n.label, n.icon ?? n.shape])).toEqual([
      ['k8s-deployment-default-web', 'web', 'nginx'],
      ['k8s-service-default-web', 'web', 'k8s'],
      ['k8s-service-default-headless', 'headless', 'k8s'],
      ['k8s-ingress-default-public', 'public', 'stadium'],
      ['k8s-persistentvolumeclaim-default-uploads', 'uploads', 'cylinder'],
      ['k8s-statefulset-default-db', 'db', 'postgres'],
      ['k8s-cronjob-default-nightly', 'nightly', 'k8s'],
      ['k8s-pod-default-debug', 'debug', 'k8s'],
      ['k8s-service-default-listed', 'listed', 'k8s'],
      ['k8s-pvc-default-pgdata-db', 'pgdata', 'cylinder'],
    ]);
    const note = (id: string) => p.nodes.find((n) => n.id === id)?.note;
    expect(note('k8s-deployment-default-web')).toBe(
      'Deployment\nreplicas: 3\nimage: nginx:1.27, acme/sidecar',
    );
    expect(note('k8s-service-default-web')).toBe('Service\nClusterIP');
    expect(note('k8s-service-default-headless')).toBe('Service');
    expect(note('k8s-ingress-default-public')).toBe('hosts: shop.example');
    expect(note('k8s-pod-default-debug')).toBe('Pod');
  });

  it('joins Services by selector, Ingresses by backend and workloads to their claims', () => {
    expect(part(SHOP).edges).toEqual([
      { from: 'k8s-service-default-web', to: 'k8s-deployment-default-web' },
      { from: 'k8s-service-default-web', to: 'k8s-cronjob-default-nightly' },
      { from: 'k8s-ingress-default-public', to: 'k8s-service-default-web' },
      {
        from: 'k8s-deployment-default-web',
        to: 'k8s-persistentvolumeclaim-default-uploads',
        line: 'dashed',
      },
      { from: 'k8s-statefulset-default-db', to: 'k8s-pvc-default-pgdata-db', line: 'dashed' },
    ]);
  });

  it('says the kinds it did not draw, silent about configuration', () => {
    // In reading order: the nameless Deployment, the list document, the List inside a List (walked one level
    // only), then the kinds the drawing does not hold.
    expect(part(SHOP).skipped).toEqual([
      { key: 'Deployment', count: 1 },
      { key: '(document without kind)', count: 1 },
      { key: 'List', count: 1 },
      { key: 'HorizontalPodAutoscaler', count: 1 },
    ]);
  });

  it('frames each namespace when there are several', () => {
    const p = part(`
kind: Deployment
metadata: { name: api, namespace: shop }
---
kind: Ingress
metadata: { name: edge, namespace: shop }
spec: { backend: { serviceName: api } }
---
kind: Service
metadata: { name: api, namespace: shop }
spec: { selector: { app: api } }
---
kind: Deployment
metadata: { name: api, namespace: ops }
spec: { template: { metadata: { labels: { app: api } } } }
`);
    expect(p.groups).toEqual([
      {
        id: 'ns-shop',
        label: 'shop namespace',
        members: ['k8s-deployment-shop-api', 'k8s-ingress-shop-edge', 'k8s-service-shop-api'],
      },
      { id: 'ns-ops', label: 'ops namespace', members: ['k8s-deployment-ops-api'] },
    ]);
    // A Service picks workloads of its own namespace only; the shop Deployment has no labels to match.
    expect(p.edges).toEqual([{ from: 'k8s-ingress-shop-edge', to: 'k8s-service-shop-api' }]);
  });

  it('has nothing to draw without a workload, Service, Ingress or claim', () => {
    expect(draw('kind: ConfigMap\nmetadata: { name: a }')).toMatchObject({
      ok: false,
      error: { code: 'nothing-to-draw' },
    });
  });

  it('reads 2,000 objects within its budget', () => {
    const docs: string[] = [];
    for (let i = 0; i < 1000; i++)
      docs.push(
        `kind: Deployment\nmetadata: { name: app${i} }\nspec: { template: { metadata: { labels: { app: a${i} } } } }`,
        `kind: Service\nmetadata: { name: app${i} }\nspec: { selector: { app: a${i} } }`,
      );
    const read = parseKubernetesText(docs.join('\n---\n'));
    if (!read.ok) throw new Error(read.error.message);
    const ms = cpuMsOf(() => kubernetesPart(read.docs, 'k8s'));
    expect(ms).toBeLessThan(cpuBudgetMs(300));
  });
});
