// A Map-backed stand-in for the slice of KVNamespace the calls switch uses (get and put of text), for tests.
export type FakeKv = KVNamespace & { store: Map<string, string>; gets: number; failGets: boolean };

export function fakeKv(initial: Record<string, string> = {}): FakeKv {
  const store = new Map(Object.entries(initial));
  const kv = {
    store,
    gets: 0,
    failGets: false,
    async get(key: string) {
      kv.gets += 1;
      if (kv.failGets) throw new Error('KV unavailable');
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  };
  return kv as unknown as FakeKv;
}
