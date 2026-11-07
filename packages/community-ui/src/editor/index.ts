// An app editor's side of the Community (liveworkspace/docs/specs/007-community/community.md "Shared pieces"): the
// post's state for the header's Public badge, Make a Copy's `?copy=1`, and reading a community link's post. Small
// and free of the Share tab's code, so the editor's first load can take it.
export { hasAutoCopyParam, useAutoCopyParam, withoutAutoCopyParam } from './auto-copy';
export {
  getCommunityState,
  itemIsPublic,
  setCommunityState,
  useCommunityState,
} from './state-store';
export { readCommunityShareInfo } from './share-info';
