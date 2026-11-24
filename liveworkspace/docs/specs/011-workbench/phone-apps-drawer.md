# The phone's top row: logo, Apps and the Apps drawer

Every editor floats two cards across a phone's top: the menu card at the left (a hamburger that opens the Explorer
panel, an app's mode switch), the palette strip beside it, and a corner card at the right with Call, Share, Copy,
Present, the approval's badge and the account. On a 390 px phone the corner card took a third of the row, its buttons
were glyphs alone, and the palette strip scrolled after three tools. Owner, 2026-11-24 (Work Tracker 1407, the approved
"Phone Editor Header" design): one header card, everything else in a drawer.

## The rule

On a phone (`PHONE_MEDIA_QUERY`: narrower than 640 px, or a touch screen under 500 px tall; the `phone:` variant), in
every editor (livediagram, liveplanner, livedocuments, livedesign, livehuddle, liveknowledge):

1. **The menu card holds the app's logo and an Apps button.** The logo (the app's prism, `BrandMark`) takes the
   hamburger's place and does what it did: it opens the Explorer panel (the menu card), and its accessible name stays
   **Explorer**. Apps follows it: a 3 x 3 dots glyph, named **Apps**. An app's mode switch (livediagram's) keeps its
   place after them, its icon alone, as on a phone today. liveplanner's menu card keeps a maximised element's name
   after them (`MenuNameSlot`), as it does today.
2. **The top-right corner card is not drawn.** Its actions move to the Apps drawer, and the palette strip takes its
   width: the corner card's room (`--corner-card-room`, `--corner-card-span`) is cleared and `CORNER_CARD_EVENT` sent,
   so the strip (and liveplanner's header band) re-measures in the same commit. liveknowledge's top row drops its
   right-hand actions slot the same way.
3. **Apps opens the Apps drawer**, the shared `PhoneDrawer` ([phone-drawers.md](phone-drawers.md)): its handle, scrim,
   Escape, focus kept inside and handed back to Apps when it closes.
4. **Bigger targets.** The menu card and the palette strip grow from 36 px buttons in about 48 px cards to **44 px
   buttons in 56 px cards**, 14 px corners, 6 px from the screen's sides and from each other. liveknowledge's top row is
   56 px on a phone already.
5. **Desktop and tablet are unchanged**: from the phone breakpoint up the menu card has its hamburger, the logo its own
   card, and the corner card its place.

The footer's Inbox bell stays as it is.

## The Apps drawer

From the top:

- **Header.** The app's logo (40 px), the item's name (one line, cut with an ellipsis) and under it the app and who can
  see it: `livediagram · Shared`, `liveplanner · Shared and Team`, `livedocuments · Private` (the Share button's own
  visibility words, `shareStatesLabel`). A round 44 px **Close** at its right.
- **A grid of tiles**, three to a row, each 84 px tall with its glyph over its name. In this order, and **only where the
  app and the viewer's role offer the action today** (no dead tiles):

  | Tile        | Shown when                                                                     | Does                                                                           |
  | ----------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
  | Explorer    | Always                                                                         | Goes to the Explorer page on the item's place (`explorerItemHref`), no panel   |
  | Call        | The app has Start a Call Here and the viewer may start one, or a call is live  | Starts the call in its own tab, or joins the live one (**Join Call**, `3 in Call`) |
  | Share       | The corner card would show Share (an Editor who may share, hydrated, no welcome) | Opens the Share dialog                                                         |
  | Present     | The corner card would show Present                                             | Starts the presentation                                                        |
  | Copy Link   | The item has an address others can open (not an Offline item)                  | Copies the page's address and says so in a toast                               |
  | Make a Copy | The corner card would show Copy (a visitor)                                    | Duplicates the item into the viewer's own files                                |
  | Inbox       | A signed-in account, in an app with an Inbox (not livehuddle)                  | Goes to the Explorer's Inbox page; a red count while it has unread items      |

- **The item's own actions.** What an app adds to its corner card beyond these (the approval's badge, livedesign's
  Prototype, liveplanner's Preview and Share Form while a form tab is open, which then stand in for Share, livehuddle's
  call-about-an-item card) show in a row under the grid with their names, as on a desktop.
- **A divider, then the Account row**: the account's picture (or initials) in its own colour, **Account**, and
  **Settings, theme and sign out** under it. It opens what the account control's Account item opens (Settings on its
  Account category, where Sign Out lives). Signed out it is **Sign In**, which returns here after. While the session
  is still loading there is no row.

A tile that navigates (Explorer, Inbox) is a link; a tile that acts closes the drawer first, so what it opens (the
Share dialog, a toast) is not under the scrim.

## The unread dot

While the Inbox has unread items, the Apps button wears an 8 px red dot at its top right, ringed in its own fill, and
its accessible name carries the count: **Apps, 3 in Inbox**. The Inbox tile shows the count (`99+` past 99). The count is
the one `useEditorInbox` already reads for the hamburger's badge, so nothing new is fetched.

## Share roles

The drawer shows a person what the corner card showed them. An **Editor** who may share: Explorer, Call, Share,
Present (where the app offers it on a phone), Copy Link, Inbox. A **Participant** or **Viewer** on a share link:
Explorer, Call only to join a live one unless their account may start one, Copy Link, Make a Copy where the app offers
it, Inbox when signed in. A **guest**: Explorer, Copy Link, and Sign In.

## Performance

No new request: the drawer reads the corner card's own props (published to a module store by the same component that
drew the card), the call store and the Inbox count the menu card already reads. The store tells the Apps button only
when what the drawer would show changes (a key of its tiles and words), not on every editor render; the open drawer
alone listens to every change. The drawer renders only while open, through the `PhoneDrawer` already in every editor's
bundle. On a desktop nothing is published and nothing new renders.
