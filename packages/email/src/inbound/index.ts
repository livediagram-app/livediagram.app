// Mail the platform takes in (liveworkspace/docs/specs/003-accounts/inbound-email.md): an app's `email()` handler
// reads each message through here, and decides itself what it makes.
export { authenticationOf, type InboundAuthentication } from './authentication';
export { htmlToText } from './html-text';
export { INBOUND_DEPTH_MAX, INBOUND_PARTS_MAX } from './mime';
export { stripQuotedReply } from './quoted';
export {
  readInboundMail,
  type InboundAttachment,
  type InboundMail,
  type ReadOptions,
} from './read';
export { addressOf, decodeEncodedWords } from './words';
