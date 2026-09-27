// The Trash's one calm line in every delete confirmation
// (docs/specs/013-workspace/trash.md): deletion still reads as final, and
// this says there is a way back, once, without pointing anywhere.
import { TRASH_RETENTION_DAYS } from '@livediagram/api-schema';

export const TRASH_RESTORE_HINT = `You can restore it from the Trash within ${TRASH_RETENTION_DAYS} days.`;

export const TEAM_TRASH_RESTORE_HINT = `Any teammate can restore it from the team’s Trash within ${TRASH_RETENTION_DAYS} days.`;
