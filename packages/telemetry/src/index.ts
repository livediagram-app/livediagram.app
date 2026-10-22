// The liveworkspace telemetry contract (liveworkspace/docs/telemetry.md): which apps send events, what
// a batch looks like, and the dashboard's summary. Shared by the central service, its dashboard, and
// every app's emitters, so none of them can drift from the others.

export * from './apps';
export * from './summary';
export * from './wire';
