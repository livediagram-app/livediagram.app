// @liveworkspace/explorer/inbox-notices: an open editor hearing of new Inbox rows (liveworkspace/docs/specs/004-index/
// inbox-notices.md): the watch, the notice and the Explorer button's count. Small on purpose, so an editor's first
// load carries none of the Explorer.

export {
  INBOX_WATCH_IDLE_MS,
  INBOX_WATCH_POLL_MS,
  INBOX_WATCH_RETURN_MS,
  createInboxWatch,
  inboxSignature,
  inboxWatchFor,
  type InboxWatch,
} from './watch';
export { NOTICE_MAX_AGE_MS, noticeRows, type NoticeRow } from './rows';
export { NOTICE_SHOW_MS } from './center';
export { seenStoreFor } from './seen';
export { InboxCountBadge, inboxButtonLabel } from './InboxCountBadge';
export { useInboxNotices, type InboxNoticeEvent, type InboxNotices } from './useInboxNotices';
