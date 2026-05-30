// Thin re-export layer kept for backwards compatibility with existing
// import sites. Everything lives in `api-client.ts` now — the live app
// no longer uses localStorage for diagram persistence. The post-Clerk
// auth phase will replace `X-Owner-Id` with a real auth token but the
// surface stays the same.

export {
  apiDeleteDiagram as deleteDiagram,
  apiListDiagrams as listDiagrams,
  apiLoadDiagram as loadDiagram,
  apiLoadSelf as loadSelfParticipant,
  apiLoadShared as loadSharedDiagram,
  apiSaveDiagram as saveDiagram,
  apiSaveSelf as saveSelfParticipant,
  apiShareDiagram as shareDiagram,
  apiUnshareDiagram as unshareDiagram,
  connectRoom,
} from './api-client';
export type {
  DiagramSummary,
  RoomHandlers,
  RoomIncoming,
  RoomOutgoing,
  StoredDiagram,
} from './api-client';
