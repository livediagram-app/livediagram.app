// Teams (liveworkspace/docs/specs/003-accounts/accounts.md "Teams"): made and run on liveworkspace.app, the same team in
// every app. A member row doubles as the invitation: 'invited' until the person with that verified
// address accepts ('joined') or declines ('declined', from the site or the email's link; an invitation
// nobody answers in 28 days becomes 'declined' too, stamped expiredAt); leaving or being removed
// makes it 'removed'. A team can also have one join link an admin turns on, good for a week.
// Rows are never deleted, and every write takes the next rev from team_seq in the same batch, so the
// apps can follow every change through teamChanges().

export {
  TEAM_NAME_MAX_LENGTH,
  MAX_TEAMS_PER_ACCOUNT,
  MAX_MEMBERS_PER_TEAM,
  ORGANISATION_MAX_LENGTH,
  INVITE_LINK_TTL_MS,
  REMINDER_AGES_MS,
  INVITATION_TTL_MS,
  EXPIRE_BATCH,
  REMINDER_BATCH,
  MAX_REMINDER_ATTEMPTS,
  type TeamRole,
  type MemberStatus,
  type Actor,
  type Result,
  cleanOrganisation,
  cleanTeamName,
  cleanEmail,
} from './teams/shared.ts';
export {
  type MemberPreview,
  LIST_PREVIEW_MEMBERS,
  type MyTeam,
  listMyTeams,
  type TeamClaim,
  teamsClaim,
  type Invitation,
  listMyInvitations,
  getMembership,
  type Member,
  listMembers,
} from './teams/reads.ts';
export { createTeam, updateTeam, deleteTeam } from './teams/manage.ts';
export {
  inviteMember,
  setMemberRole,
  removeMember,
  answerInvitation,
  DELETED_MEMBER_EMAIL,
  leaveAllTeams,
} from './teams/members.ts';
export {
  type TeamChange,
  type MemberChange,
  type TeamChanges,
  parseCursor,
  CHANGES_PAGE_SIZE,
  teamChanges,
} from './teams/changes.ts';
export { sha256, type DeclineStatus, readDeclineToken, declineByToken } from './teams/tokens.ts';
export {
  inviteLinkToken,
  joinLinkUrl,
  type InviteLink,
  currentInviteLink,
  makeInviteLink,
  clearInviteLink,
  type JoinPreview,
  previewInviteLink,
  joinByInviteLink,
} from './teams/join-link.ts';
export {
  type ReminderEmail,
  sweepInvitations,
  inviteResponseRecipients,
} from './teams/reminders.ts';
