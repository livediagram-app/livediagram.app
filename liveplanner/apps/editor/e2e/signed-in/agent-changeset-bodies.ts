// The elements and changeset bodies the agent changeset spec sends (agent-changesets.spec.ts), kept apart from
// Playwright so the api's route test can run the same bodies through the real changeset route
// (apps/api/src/routes/changesets.test.ts, "the E2E spec's bodies"). An agent adds and changes only what a Plan tab holds
// (docs/specs/024-agents/edit-operations.md "What a changeset changes"), so these are Dashboard views, never shapes.

// The view Webber's project starts with.
export const ARRANGED_VIEW = {
  id: 'api',
  type: 'shape',
  shape: 'plan-view',
  x: 200,
  y: 200,
  width: 320,
  height: 200,
  label: 'API',
  planView: { view: 'gantt' },
} as const;

// The agent adds a second view beside it.
export const ADD_PAYMENTS_VIEW = {
  operations: [
    {
      op: 'add',
      element: {
        id: 'payments',
        type: 'shape',
        shape: 'plan-view',
        x: 600,
        y: 200,
        width: 320,
        height: 200,
        label: 'Payment service',
        planView: { view: 'gantt' },
      },
    },
  ],
  summary: 'add payment service',
} as const;

// The agent renames the view the person has selected.
export const RENAME_API_VIEW = {
  operations: [{ op: 'set', target: 'api', fields: { label: 'Gateway' } }],
} as const;
