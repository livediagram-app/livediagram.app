// @liveworkspace/explorer/approvals: the editor's approvals kit (liveworkspace/docs/specs/004-index/approvals.md "In the
// editor"): the door and its provider, the header's badge and the approver's banner. Small on purpose, so an editor's
// first load carries none of the Explorer; the Share dialog's Approval tab comes with the dialog.

export {
  APPROVAL_REFRESH_MS,
  ApprovalDoorProvider,
  useApprovalDoor,
  useEditorApprovalDoor,
  type ApprovalClient,
  type ApprovalContext,
  type ApprovalDoor,
  type ApprovalTeamMember,
  type ApprovalTeamPerson,
} from './door';
export { ApprovalBadge } from './ApprovalBadge';
export { ApprovalBanner } from './ApprovalBanner';
