// The Trash's one quiet line in every delete confirmation
// (docs/specs/013-workspace/trash.md): deletion still reads as final, and
// this says, once, where the way back is.
import { TRASH_RETENTION_DAYS } from '@livediagram/api-schema';

export const TRASH_RESTORE_HINT = `It can be restored from Settings › Trash for ${TRASH_RETENTION_DAYS} days.`;

export const TEAM_TRASH_RESTORE_HINT = `Any teammate can restore it from Settings › Trash for ${TRASH_RETENTION_DAYS} days.`;
