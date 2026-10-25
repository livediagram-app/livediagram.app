import {
  readLocalStorageSafe,
  writeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';

// "Not Now" on the offer to move retired parts (docs/specs/006-document/offline-mode.md "Moving retired parts to
// the other apps"), remembered for this browser: the set-aside is this browser's, and happens once, so there is no
// count to grow. Settings' row offers it again.

const KEY = 'livediagram:v2:retired-parts-dismissed';

export function retiredPartsOfferDismissed(): boolean {
  return readLocalStorageSafe(KEY) === '1';
}

export function dismissRetiredPartsOffer(): void {
  writeLocalStorageSafe(KEY, '1');
}
