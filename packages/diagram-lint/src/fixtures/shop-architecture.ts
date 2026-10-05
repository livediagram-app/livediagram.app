// The research's 15-node, 16-edge shop architecture (docs/research/agent-cli/authoring-from-scratch.md §1,
// §10), grouped by tier as an agent first writes it.

import type { GraphInput } from '@livediagram/document';

export function shopArchitecture(): GraphInput {
  return {
    direction: 'right',
    groups: [
      { id: 'clients', label: 'Clients' },
      { id: 'edge', label: 'Edge' },
      { id: 'core', label: 'Core services' },
      { id: 'data', label: 'Data' },
      { id: 'ext', label: 'Third parties' },
    ],
    nodes: [
      { id: 'web', label: 'Web app', group: 'clients' },
      { id: 'mobile', label: 'Mobile app', group: 'clients' },
      { id: 'cdn', label: 'CDN', group: 'edge' },
      { id: 'gw', label: 'API gateway', group: 'edge' },
      { id: 'auth', label: 'Auth service', group: 'core' },
      { id: 'orders', label: 'Orders service', group: 'core' },
      { id: 'pay', label: 'Payments service', group: 'core' },
      { id: 'inv', label: 'Inventory service', group: 'core' },
      { id: 'notify', label: 'Notifications', group: 'core' },
      { id: 'bus', label: 'Event bus', shape: 'stadium' },
      { id: 'ordersdb', label: 'Orders DB', shape: 'cylinder', group: 'data' },
      { id: 'invdb', label: 'Inventory DB', shape: 'cylinder', group: 'data' },
      { id: 'cache', label: 'Redis cache', shape: 'cylinder', group: 'data' },
      { id: 'stripe', label: 'Stripe', group: 'ext' },
      { id: 'email', label: 'Email provider', group: 'ext' },
    ],
    edges: [
      { from: 'web', to: 'cdn' },
      { from: 'web', to: 'gw' },
      { from: 'mobile', to: 'gw' },
      { from: 'gw', to: 'auth' },
      { from: 'gw', to: 'orders' },
      { from: 'gw', to: 'inv' },
      { from: 'orders', to: 'pay' },
      { from: 'orders', to: 'ordersdb' },
      { from: 'orders', to: 'bus', label: 'OrderPlaced' },
      { from: 'inv', to: 'invdb' },
      { from: 'inv', to: 'cache' },
      { from: 'bus', to: 'notify' },
      { from: 'bus', to: 'inv' },
      { from: 'pay', to: 'stripe' },
      { from: 'notify', to: 'email' },
      { from: 'auth', to: 'cache' },
    ],
  };
}
