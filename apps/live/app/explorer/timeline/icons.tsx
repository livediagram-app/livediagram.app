// Per-event-type glyphs for the Timeline (spec/138 §2).
//
// The shared package draws one icon per SOURCE type, which is enough
// to tell a diagram bubble from a team one. That's the right default
// for a product-agnostic component, but a feed where twelve diagram
// events all wear the same square is harder to skim than one where a
// comment looks like a comment. These override per event type; the
// source-type glyph remains the fallback for anything unmapped, so a
// new event type from a newer worker still renders.

import type { ReactNode } from 'react';

function Glyph({ d }: { d: string }) {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const PLUS = 'M12 4.5v15m7.5-7.5h-15';
const PENCIL =
  'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z';
const TRASH =
  'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0';
const CHAT =
  'M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z';
const CHECK = 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
const FOLDER =
  'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z';
const LINK =
  'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244';
const COPY =
  'M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m0 0h3.375c.621 0 1.125.504 1.125 1.125v3.5';
const USER_PLUS =
  'M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z';
const USER_MINUS =
  'M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z';
const ENVELOPE =
  'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75';
const SHIELD =
  'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751A11.959 11.959 0 0112 2.714z';
const CLOCK = 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z';
const KEY =
  'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z';
const PALETTE =
  'M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.44 1.152-.44 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z';
const PHOTO =
  'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z';

const EYE =
  'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z';
const CLOUD_OFF =
  'M3 3l18 18M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-9.198-1.02';
const CLOUD =
  'M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z';
const FOLDER_MINUS =
  'M9 13.5h6m5.25 5.25V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44l-2.122-2.12a1.5 1.5 0 00-1.06-.44H4.5A2.25 2.25 0 002.25 6v12.75A2.25 2.25 0 004.5 21h15a2.25 2.25 0 002.25-2.25z';
const KEY_OFF = 'M3 3l18 18M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912M9.75 14.25L2.909 21.09';

export const EVENT_ICONS: Record<string, ReactNode> = {
  diagram_created: <Glyph d={PLUS} />,
  diagram_edited: <Glyph d={PENCIL} />,
  diagram_renamed: <Glyph d={PENCIL} />,
  diagram_deleted: <Glyph d={TRASH} />,
  diagram_duplicated: <Glyph d={COPY} />,
  diagram_moved: <Glyph d={FOLDER} />,
  team_diagram_added: <Glyph d={FOLDER} />,
  team_diagram_removed: <Glyph d={FOLDER} />,
  comment_added: <Glyph d={CHAT} />,
  comment_resolved: <Glyph d={CHECK} />,
  action_assigned: <Glyph d={USER_PLUS} />,
  action_completed: <Glyph d={CHECK} />,
  share_link_created: <Glyph d={LINK} />,
  share_link_expiring: <Glyph d={CLOCK} />,
  team_created: <Glyph d={SHIELD} />,
  team_invite_received: <Glyph d={ENVELOPE} />,
  team_invite_accepted: <Glyph d={USER_PLUS} />,
  team_invite_declined: <Glyph d={USER_MINUS} />,
  team_member_joined: <Glyph d={USER_PLUS} />,
  team_member_left: <Glyph d={USER_MINUS} />,
  team_member_removed: <Glyph d={USER_MINUS} />,
  team_role_changed: <Glyph d={SHIELD} />,
  token_created: <Glyph d={KEY} />,
  token_expiring: <Glyph d={CLOCK} />,
  theme_saved: <Glyph d={PALETTE} />,
  image_uploaded: <Glyph d={PHOTO} />,
  diagram_offline: <Glyph d={CLOUD_OFF} />,
  diagram_synced: <Glyph d={CLOUD} />,
  diagram_opened_by_visitor: <Glyph d={EYE} />,
  diagram_copied_by_visitor: <Glyph d={COPY} />,
  folder_created: <Glyph d={FOLDER} />,
  folder_deleted: <Glyph d={FOLDER_MINUS} />,
  team_renamed: <Glyph d={PENCIL} />,
  team_deleted: <Glyph d={TRASH} />,
  team_invite_link_enabled: <Glyph d={LINK} />,
  team_invite_link_disabled: <Glyph d={LINK} />,
  token_revoked: <Glyph d={KEY_OFF} />,
  theme_deleted: <Glyph d={TRASH} />,
};
