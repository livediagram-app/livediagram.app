# Wireframe pages

A **wireframe page** is the fifth kind of page in Pages mode ([Pages](pages-mode.md) "Page kinds"):
a screen to wireframe on, framed by the **device** it is for. Choosing a device (a phone, a tablet,
a laptop, a desktop monitor, a browser window or a watch) makes the page that device: its sheet is
the device drawn front on, at its real size, and what is on the page lives on its **screen**.
Everything [Pages](pages-mode.md) says of a page applies to a wireframe page except
where this spec says otherwise.

## Domain language

| Term               | Means                                                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **wireframe page** | A page of kind `wireframe` (`Page.kind`).                                                                                                                                                           |
| **device**         | What the page is framed as (`Page.device`, a `WireframeDeviceId`): one of the devices below. Absent on a wireframe page is the **iPhone**.                                                          |
| **device class**   | A device's family: **phone**, **tablet**, **computer** or **watch**. Layouts and the content gutter follow it.                                                                                      |
| **device frame**   | The device drawn round the screen: its body, bezel, camera, buttons, a laptop's base, a monitor's stand, a browser's toolbar. A view of the page, never elements.                                   |
| **screen**         | The device's display: the rectangle (rounded as the device's is) the page's content lives on, painted with the page's background.                                                                   |
| **system bars**    | The status bar across the top of a phone, tablet or watch screen (the time, signal, Wi-Fi and battery) and the home indicator across its foot. Drawn over the content, as a real screen draws them. |
| **safe area**      | The screen less its system bars (while shown) and the device class's **gutter**: what layouts fill and what snapping offers as the page's margin.                                                   |
| **frame look**     | How the device frame is drawn (`Page.frameLook`): **Theme** (absent: in the tab theme's colours), **Dark**, **Light** or **Outline** (a line drawing, no fill, for a low-fidelity look).            |

## The devices

Every size is the device's screen in CSS px (its logical resolution), so a wireframe is drawn at
the size the screen shows it. The device frame adds its own bezel round it.

| Device             | Id               | Class    | Screen (portrait)             | Turns | Frame                                                                                                                                                                                         |
| ------------------ | ---------------- | -------- | ----------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **iPhone**         | `iphone`         | phone    | 393 x 852                     | Yes   | Thin even bezel, deep round corners, the Dynamic Island, side buttons.                                                                                                                        |
| **iPhone Duo**     | `iphone-duo`     | phone    | 626 x 890 (opened: 890 x 626) | Yes   | Apple's book-style foldable, opened: one inner screen, a faint crease down the fold, hinge notches at the frame's edges, its camera under the display (no island). Held landscape by default. |
| **Android Phone**  | `android`        | phone    | 412 x 915                     | Yes   | Thin bezel, gentler corners, a punch-hole camera, side buttons.                                                                                                                               |
| **iPad**           | `ipad`           | tablet   | 820 x 1180                    | Yes   | An even bezel with the camera in it, rounded corners.                                                                                                                                         |
| **Android Tablet** | `android-tablet` | tablet   | 800 x 1280                    | Yes   | A wider bezel with the camera in it.                                                                                                                                                          |
| **Laptop**         | `laptop`         | computer | 1440 x 900                    | No    | A lid with a camera in its top bezel, on a base wider than the lid.                                                                                                                           |
| **Desktop**        | `desktop`        | computer | 1920 x 1080                   | No    | A monitor with a chin, on a neck and foot.                                                                                                                                                    |
| **Browser**        | `browser`        | computer | 1440 x 900                    | No    | A browser window: traffic lights, back and forward, the address bar, a menu.                                                                                                                  |
| **Watch**          | `watch`          | watch    | 198 x 242                     | No    | A rounded case with its crown, the band's ends above and below.                                                                                                                               |

The **page size** of a wireframe page is its device: the page's rect is the whole device frame,
the screen inset within it. A turned phone or tablet is landscape: the screen's sides swap and the
frame turns with it (the iPhone's Dynamic Island and the Android camera then sit at the left).

- The page label reads `<name or Page n> · <device> · Wireframe` (`iPhone`, `iPad · Landscape`).
- A stored wireframe page with no device, or one this build does not know, is read as the iPhone;
  a `frameLook` it does not know as Theme; an orientation on a device that does not turn as portrait.
- **Frame looks**: **Theme** draws the device in the tab theme's colours (its element stroke as the
  device's edge, the bezel that colour near black, buttons and stands it darkened, a browser's
  toolbar the canvas washed with it and its address field the element fill), so a frame changes with
  the theme; **Dark** is graphite, **Light** silver with white bezels, **Outline** lines in slate.
  The device tiles draw each device in the page's look.
- **The finish**: under a hand-drawn finish ([Finish](../008-canvas/finish.md): **Sketch**, **Marker**)
  the frame is drawn by hand too, as a line drawing in the look's ink (the theme's colour for Theme,
  graphite for Dark, grey for Light and Outline): Sketch's doubled pencil strokes, Marker's felt-tip.
  Flexible and Professional draw it as above. The screen, its content's clip and the system bars
  stay as they are.
- **The device is the page's for good**: chosen as the page is added (Choose a Device, or the + that
  adds another like the last), never changed afterwards; a different device is a new page.
- **Re-fitting**: turning it, or turning its system bars on or off, keeps the content and re-fits it
  into the new safe area as a change of page size does ([Pages](pages-mode.md) "Sizes"): content that still fits
  stays its size, centred; content that does not is scaled down as one.
- Laying loose content out into pages never makes a wireframe page.

## The screen

- **Background**: the page's background paints the screen alone: the Background swatches,
  gradients, patterns (a **Grid** pattern reads as a layout grid), pictures and the
  **Animated** backgrounds ([Pages](pages-mode.md) "Animated backgrounds"), moving inside the screen
  and still as it opens in an export. The plain paper is white (the dark canvas theme's sheet colour in the dark editor).
- **Clipping**: what is on the page is cut off at the screen's edge and its rounded corners, never
  drawn over the bezel; a press on the bezel is a press on the canvas.
- **System bars** (phones, tablets, the watch): on by default. The status bar shows **9:41** (the
  watch **10:09**), signal, Wi-Fi and battery (the watch the time alone), in ink that reads on the
  screen's background (white on a dark one). The home indicator is a short rounded bar centred at
  the screen's foot. A phone turned landscape shows no status bar (as phones hide it) but keeps
  the home indicator. **System Bars** (the Device popover) turns them off on that page.
- **Browser toolbar**: a browser page's toolbar is part of the frame, above the screen: the traffic
  lights, back and forward, a reload, the address field (a lock and the page's address) and a
  menu. The address is `example.com` on an unnamed page and `example.com/<the page's name, in lower
case with dashes>` on a named one, so naming the page names the screen.
- **Safe area**: the screen less the shown system bars, then a gutter each side: phone 16 px, tablet
  24, computer 32, watch 8. Snapping offers the screen's edges and centre lines in place of the
  sheet's, and the safe area in place of the margin.

## Choosing the device

- **Adding one**: the **Add a page** popover and the first page's choice offer a fifth card,
  **Wireframe**: "A screen to wireframe, framed as a phone, tablet, laptop or browser." Choosing it
  turns the popover (or the first page's choice) to **Choose a Device**: a tile per device, each a
  miniature of its frame over its name and screen size, grouped **Phones**, **Tablets**,
  **Computers** and **Watch**, with **Back** to the kinds. The device last chosen in this browser
  is ringed and focused first (the iPhone the first time). A tile shows the device's shorter name
  where it has one (**Android** under Phones and under Tablets). Arrow keys move between the tiles, Enter
  or a press adds the page in that device; Escape goes back to the kinds (from the popover's first
  step, closes it).
- A new wireframe page takes the device and frame look of the last wireframe page, when the
  device was not just chosen; on the plain paper, with its system bars shown.
- **Beside the cog**: a wireframe page's title bar holds, for someone who may edit it, a **Device**
  button (the device's glyph, and on a desktop its name) opening the **Device popover** anchored to
  it:
  - **Device**: the page's device, its miniature, name and screen size, shown, not changed.
  - **Orientation**: **Portrait** / **Landscape**, while the device turns.
  - **Frame**: **Theme**, **Dark**, **Light**, **Outline**.
  - **System Bars**: a switch, while the device has them ("The status bar and home indicator").

  Each choice is one undoable page edit, synced to everyone. The page's **Layouts** and
  **Background** sit beside it in its title bar ([Pages](pages-mode.md) "Beside the cog"). The Layouts popover offers no **Change
  Theme** on a wireframe page (its screens are drawn in wireframe greys), and a wireframe page never
  shows the in-page **Start From a Layout** card: its screen stays clear, its layouts are the
  button's.

- **The label** above the page names it and its device (`iPhone · Wireframe`), never "Page n": the
  page navigator under the page says which it is.
- **Framing**: going to a wireframe page fits the whole device to the screen, zooming in past 100%
  (up to 250%) where it is small, so a watch fills the view as a phone does.

- **The page panel**: a wireframe page's panel holds **Device** (the same sections as the popover),
  its one tab; its Background and Layouts are beside its cog.

## Wireframe layouts

A wireframe page's Layouts are the **wireframe layouts**: whole screens built for the page's safe
area, in the tab's theme, from ordinary elements (text, shapes, icons, cards, the checklist), so
every part is editable. Each phone, tablet and computer layout is **responsive**: built for the
device class it lands on, a single column on a phone, a wider arrangement (sidebars, columns, a
hero beside its picture) on a tablet or computer. A watch has its own nine. Forty screens in nine
categories, and the watch's:

- **Start**: **Onboarding** (a picture, a headline, a line, progress dots and Continue), **Sign In**
  (email and password, Sign In and Continue with Google; a computer splits it beside a picture),
  **Sign Up** (name, email, password and the terms; a quote panel beside it on a computer), **Verify
  Code** (a six-digit code, one box being typed), **Permissions** (what the app may use, a switch
  each), **Empty State** (an icon in a disc, a headline, a line and one button).
- **Browse**: **Home Feed** (a search, filter chips and cards of picture and text; a computer a grid
  of cards), **Search Results** (a search, a count and result rows), **Article** (a title, its author,
  a picture and the story; a computer adds More Stories), **Places** (a map with pins and the chosen
  place's card; a computer a list beside the map).
- **Shop**: **Shop Grid** (products in a grid; a computer category and price filters beside),
  **Product Detail** (a picture, a name, a price, sizes and Add to Cart), **Cart** (items with
  steppers, a promo code and the total; a summary column on a computer), **Checkout** (delivery and
  payment fields, a summary and Pay), **Order Tracking** (an order's steps from placed to delivered;
  a map and the item beside on a computer).
- **Social**: **Profile** (an avatar, a name, three stats and a grid of pictures), **Post** (a photo
  post, its reactions and comments; the comments beside the picture on a computer), **Stories Feed**
  (a row of stories over the feed; suggestions beside on a computer), **New Post** (writing a post
  with photos and tools; a dialog over the dimmed screen on a computer), **Chat** (a conversation and
  a message field; the conversations beside on a computer), **Notifications** (today's and earlier
  activity, unread marked).
- **Work**: **Dashboard** (four figures, a chart and a list), **Kanban Board** (columns of task
  cards; one column at a time behind chips on a phone), **Task List** (today's tasks to tick off),
  **Calendar** (the month with the day's events; the day's hours beside on a computer), **Inbox** (a
  mail list; folders, the list and the message open on a computer), **Data Table** (a search,
  filters and a table of orders).
- **Media**: **Music Player** (album art, a scrubber and the controls; a library, the tracks and a
  player bar on a computer), **Video Player** (a video, its channel and Up Next), **Podcast** (a
  show's art and its episodes), **Photo Gallery** (a grid of pictures under filters; a masonry on a
  computer).
- **Account**: **Settings** (grouped rows of switches and choices), **Edit Profile** (a photo and the
  profile's fields), **Help Center** (a search, topics and common questions, one opened).
- **Marketing**: **Landing Page** (a nav, a hero with two buttons and a picture, three features),
  **Pricing** (three plans, the middle one Popular), **Team** (the people behind the product), **Contact**
  (a message form; the contact details beside on a computer), **Blog** (a featured post over the
  latest).
- **Travel**: **Flight Search** (where, when and the flights that fit), **Boarding Pass** (the
  route, passenger, seat, gate and a barcode), **Ride** (a route on a map and the rides to choose).
- **Watch** (on a watch alone): **Glance**, **List**, **Workout**, **Now Playing**, **Weather**,
  **Timer** (a countdown ring and its controls), **Heart Rate** (the rate now and the last hour's
  bars), **Up Next** (the day's next events), **Notification**.

**How a screen fits its device.** A phone takes the single column, a tablet or computer the wider
arrangement; the **iPhone Duo** opened is one wide screen, so it takes the wider arrangement. A wide
screen shorter than 600 px (a phone turned landscape) is laid out as if 600 tall and scaled down to
it, by no more than 72%, so its type stays readable; a tall one (a tablet upright) takes the phone
column where that suits it (centred, at most 560 wide, for Onboarding, Sign In, Empty State and
Product Detail; across the width for Notifications, Calendar, Inbox and the Music Player). The top
navigation drops the links that would meet its buttons, and a dashboard's Recent Orders shows only
with room for its rows. Charts carry their own sample data in wireframe greys, with no legend.
Whatever still does not fit the safe area is scaled down as one. A watch keeps 12 px from the
face's sides and 24 px above its rounded foot.

Placeholder text is believable but generic (**Your App**, **Welcome Back**, **Product Name**,
**$49.00**). Pictures are image placeholders (an empty image, its frame shown), never stock.
A tile is the layout as it lands, drawn by the export renderer on the page's screen.

## The Elements palette

In Pages mode, while the palette's kind is **Wireframe** ([Pages mode](pages-mode.md) "The
palette's kind"), it offers an **Elements** category, after **Components**, the two first in a
band of their own with a divider after Elements: "The parts a screen is wireframed from: buttons, fields, pictures,
avatars, badges, cards and lists." Its tiles:

- **Button** (a filled rounded button labelled Button), **Outline Button**, **Text Field** (an
  outlined field with a muted placeholder, left aligned), **Search Field** (a pill field with its
  glass and a placeholder), **Chip**, **Badge** (the [badge](../009-elements/badge.md), with its presets: New,
  Beta, Version, Count, Draft, Warning), **Image Placeholder** (a grey block with the picture
  glyph), **Avatar** (a circle of initials), **Card**, **Checklist** and **Divider** (a thin rule).
- Each tile is in one category: Text and the Sticky Note are **Write**'s, and while Elements is
  offered **Components** leaves out the Card, the Badge and the Checklist it holds. Components
  opens on its **Layout** group (Hero, Header, Banner, Stack), then **Page Blocks**, then **Code
  and Lists**.
- Each part keeps its wireframe greys as placed (a dark primary button, grey pictures), over the
  theme and the style remembered for its shape.

The palette follows the page someone is on, as [Logo pages](logo-pages.md) "The Logo palette" says
of the Logo category: its kind is Wireframe on a wireframe page, opening on **Elements**; Logo on a
logo page; Design on any other. A page added (by the + or the chooser) is a page moved onto, so
the palette turns with it. In Wireframe the palette leaves out **Concepts** and **Devices** (a
screen is built from its own parts, and the page is its device already); they come back in the
other kinds.

## Templates

Start Making Pages ([Template start](start-diagramming.md)) holds a wireframe template per flow in its **Wireframes**
category:

- **Blank wireframes**, one empty wireframe page in a device, its kind already chosen: **Blank Phone
  Wireframe** (iPhone), **Blank Tablet Wireframe** (iPad), **Blank Website Wireframe** (Browser),
  **Blank Laptop Wireframe** and **Blank Watch Wireframe**.
- **Flows**, a row of wireframe pages, each named for its screen and laid out from a wireframe
  layout: **Mobile App Wireframe** (iPhone: Onboarding, Sign In, Home, Product, Checkout),
  **Website Wireframe** (Browser: Home, Pricing, Sign In), **Web App Wireframe** (Laptop: Overview,
  Orders, Settings), **Tablet App Wireframe** (iPad: Discover, Messages, Profile) and **Watch App
  Wireframe** (Watch: Glance, Today, Alert).

## Export

- A wireframe page exports as its whole device: the frame, the screen with its content clipped to
  it, and the system bars over it. PNG and SVG are **transparent** outside the device's outline (a
  device mockup is placed over other things); a PDF page stays white. Slides, page thumbnails,
  the Minimap and agents' previews draw the frame too.
- Presenting a page slide of a wireframe page presents the whole device on the black.

## Share roles

A wireframe page is a page: an **Editor** chooses its device, orientation, frame look and system
bars, places layouts and edits what is on it; a **Participant** may change what is on it as on any
page and never the device; a **Viewer** sees it, never the Device button, the popover or the
panel. Every control is gated on the session's `can` (`can.editPages` for the device), as every
page control is.

## Collaboration and agents

- The device, orientation, frame look and system bars sync like any page field; everyone sees the
  same frame.
- The `wireframe` kind, `Page.device`, `Page.frameLook` and `Page.systemBars` are part of the
  design schema the api validates and agents read and write: `change_pages` adds a wireframe
  page (`{"op": "add", "kind": "wireframe", "device": "android"}`), changes its frame look and
  system bars (`{"op": "set", "page": 2, "frameLook": "light", "systemBars": false}`) and lays it
  out from a wireframe layout; a page's rectangle answers the screen's safe area beside the page's.
  As in the editor, the device is chosen as the page is added and never changed: a `set` naming a
  device is refused, and so are a device, frame look or system bars on any other kind of page
  (`not_a_wireframe`). A result line names a wireframe page's size by its device (`iPad landscape`).

## Telemetry

`Tab · Changed ·` `WireframePageAdded`, `PageKindWireframe` (the first page's choice);
`Tab · Changed · WireframeDevice<Iphone|IphoneDuo|Android|Ipad|AndroidTablet|Laptop|Desktop|Browser|Watch>`
(a device chosen, on adding or after); `Tab · Changed · WireframeFrame<Theme|Dark|Light|Outline>`;
`UI · Toggled · WireframeSystemBarsOn` / `WireframeSystemBarsOff`. Never a name or text.

## Non-goals

- Clickable prototypes (linking a button to another screen).
- A device catalogue per model year, or custom screen sizes (a blank page in Fit to Content
  is the free-size page).
- Device photography or brand marks on the frame; the frames are drawn, generic and theme-neutral.
- Responsive re-layout of content when a device changes (it is re-fitted, not re-flowed).
