// The item's own SQLite, as its Durable Object hands it: every table here is read and written through `exec`.
export type Sql = Pick<SqlStorage, 'exec'>;
