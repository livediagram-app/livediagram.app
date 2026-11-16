// Asking for the Photo Edit sample and setting it (docs/specs/031-photo/photo-pages.md "The Photo Edit template"):
// picking the template (on a start, or by /new) asks for it for that tab; the editor, once the tab is open and the
// photo store can be reached, fetches the sample, stores its files for the tab (the store's own way: the api for a
// cloud design, this browser for an Offline Mode one), and only once they are stored sets the photos, so the pages
// never name a file the store lacks. The ask is kept in this browser tab's session, so /new's ask survives the
// editor's load; it names a tab id minted for the template, so nothing else is ever touched.
import type { PhotoBlobEntry } from '@livedesign/api-schema';
import type { Tab } from '@livedesign/design';
import { takesPhotoEditSample, withPhotoEditSample } from './photo-edit-sample';
import type { LoadedSample } from './photo-edit-sample-load';

const KEY_PREFIX = 'livedesign:photo-edit-sample:';
const asked = new Set<string>();
const inFlight = new Set<string>();

/** The sample asked for the tab a Photo Edit template has just made. */
export function askForPhotoEditSample(tabId: string): void {
  asked.add(tabId);
  try {
    sessionStorage.setItem(KEY_PREFIX + tabId, '1');
  } catch {
    // No session storage: the ask holds while this page does.
  }
}

export function photoEditSampleAsked(tabId: string): boolean {
  if (asked.has(tabId)) return true;
  try {
    return sessionStorage.getItem(KEY_PREFIX + tabId) === '1';
  } catch {
    return false;
  }
}

function forget(tabId: string): void {
  asked.delete(tabId);
  try {
    sessionStorage.removeItem(KEY_PREFIX + tabId);
  } catch {
    // Nothing kept to remove.
  }
}

export type SampleDeps = {
  load: () => Promise<LoadedSample | null>;
  // The files queued for the tab's store, and when they are all stored.
  enqueue: (tabId: string, entries: readonly PhotoBlobEntry[]) => void;
  settled: (tabId: string) => Promise<void>;
  // A tab edit to the tab by id.
  commit: (tabId: string, map: (tab: Tab) => Tab) => void;
};

/** Sets the sample on the tab when it was asked for and the tab still takes it (its one photo page unstarted); true
 *  when it was set. A tab still loading waits for a later call; a sample that cannot be had leaves the photo
 *  unstarted, its Start a Photo card as before. */
export async function applyAskedPhotoEditSample(tab: Tab, deps: SampleDeps): Promise<boolean> {
  if (inFlight.has(tab.id) || !photoEditSampleAsked(tab.id) || !takesPhotoEditSample(tab))
    return false;
  inFlight.add(tab.id);
  try {
    const sample = await deps.load();
    forget(tab.id);
    if (!sample) return false;
    deps.enqueue(tab.id, sample.entries);
    await deps.settled(tab.id);
    let set = false;
    deps.commit(tab.id, (t) => {
      const next = withPhotoEditSample(t, sample.ids);
      set ||= next !== t;
      return next;
    });
    return set;
  } finally {
    inFlight.delete(tab.id);
  }
}
