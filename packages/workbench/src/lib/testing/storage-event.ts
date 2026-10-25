// A `storage` event as another tab's write delivers it, for tests. Built on Event with the fields defined,
// rather than `new StorageEvent(type, init)`: CodeQL's model of that constructor takes one argument and
// flags the init object.
export function storageEvent(init: { key: string | null; newValue?: string | null }): StorageEvent {
  const event = new Event('storage');
  Object.defineProperties(event, {
    key: { value: init.key },
    newValue: { value: init.newValue ?? null },
    oldValue: { value: null },
    storageArea: { value: window.localStorage },
  });
  return event as StorageEvent;
}
