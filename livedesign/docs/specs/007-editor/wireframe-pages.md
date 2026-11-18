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
| **screen link**    | An element's link to another page of its tab (`ElementLink` kind `page`): pressing the element in Prototype mode goes to that screen.                                                               |
| **back link**      | An element's link back to the screen shown before (`ElementLink` kind `back`), as a phone's back button does.                                                                                       |
| **transition**     | How a screen link or back link changes screens (`transition`): **Instant** (absent), **Slide** or **Dissolve**.                                                                                     |
| **hotspot**        | A linked element as Prototype mode sees it: the part of the screen a press follows.                                                                                                                 |
| **Prototype mode** | Playing a wireframe tab's screens one at a time in their device frame, following screen links.                                                                                                      |
| **Flow view**      | The canvas drawing an arrow from each linked element to the screen it goes to.                                                                                                                      |

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
  the home indicator. **System Bars** (the Frame popover) turns them off on that page.
- **Browser toolbar**: a browser page's toolbar is part of the frame, above the screen: the traffic
  lights, back and forward, a reload, the address field (a lock and the page's address) and a
  menu. The address is `example.com` on an unnamed page and `example.com/<the page's name, in lower
case with dashes>` on a named one, so naming the page names the screen.
- **Safe area**: the screen less the shown system bars, then a gutter each side: phone 16 px, tablet
  24, computer 32, watch 12. Snapping offers the screen's edges and centre lines in place of the
  sheet's, and the safe area in place of the margin.

## Choosing the device

- **Adding one**: the first page's choice offers a card, **Wireframe**: "A screen to wireframe,
  framed as a phone, tablet, laptop or browser." Choosing it turns the choice to **Choose a Device**:
  a tile per device, each a miniature of its frame over its name and screen size, grouped **Phones**,
  **Tablets**, **Computers** and **Watch**, under the [back bar](../004-interface-design/back-bar.md) to the kinds (**All kinds** then **Wireframe**). The device last chosen in this
  browser is ringed and focused first (the iPhone the first time). A tile shows the device's shorter
  name where it has one (**Android** under Phones and under Tablets). Arrow keys move between the
  tiles, Enter or a press makes the page that device's screen; Escape goes back to the kinds.
- **More screens**: a wireframe tab holds only wireframe pages ([Pages](pages-mode.md) "One kind a
  tab"), of any devices. The **+** after the last page adds another screen like the last; the button
  under it, **Add a Screen of Another Device**, opens **Choose a Device** as a list, a row per device
  under its family, and adds a screen in the device pressed ([Pages](pages-mode.md) "A screen of
  another device"). Contents' footer offers the same pair.
- A new wireframe page takes the device and frame look of the page it is like (the +), or of the last
  wireframe page when the device was just chosen (its device the one chosen); on the plain paper, with
  its system bars shown.
- **Beside the cog**: a wireframe page's title bar holds, for someone who may edit it, a **Frame**
  button (the device's glyph, and on a desktop the word **Frame** beside it; its accessible name and
  tooltip say the device too, **Frame: iPhone**) opening the **Frame popover** anchored to it. On a
  phone it is the **Frame** row of the page's Appearance ([Pages](pages-mode.md) "On a phone"):
  - **Device**: the page's device, its miniature, name and screen size, shown, not changed.
  - **Orientation**: **Portrait** / **Landscape**, while the device turns.
  - **Look**: the frame's look, **Theme**, **Dark**, **Light**, **Outline**.
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

- **The page panel**: a wireframe page's panel holds **Device** (the same sections as the Frame popover),
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
- **Social**: **Profile** (an avatar, a name, three stats and a grid of pictures), **Post** (a back arrow and a photo
  post, its reactions and comments; the comments beside the picture on a computer), **Stories Feed**
  (a row of stories over the feed; suggestions beside on a computer), **New Post** (writing a post
  with photos and tools; a dialog over the dimmed screen on a computer), **Chat** (a back arrow, a conversation and
  a message field; the conversations beside on a computer, under a back arrow), **Notifications** (today's and earlier
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
Every word reads at 4.5:1 or more on what it sits on: the muted grey is a slate that reads at
4.5:1 on the soft grey of a table's header and a chat bubble, and the calendar's today is a labelled
disc, its number white on the ink. On the dark paper of the dark editor the words straight on the
sheet keep that contrast ([Light and dark](../011-theme/light-and-dark.md#what-a-viewer-sees),
"Words on the plain paper keep the contrast they were made with").
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
- Each tile is in one category: the text styles (Title to Caption, [Canvas and
  palette](../008-canvas/canvas-and-palette.md#text-element) "Text styles") and the Sticky Note are **Write**'s, and while Elements is
  offered **Components** leaves out the Card, the Badge and the Checklist it holds. Components
  opens on its **Layout** group (Hero, Header, Banner, Stack), then **Page Blocks**, then **Code
  and Lists**.
- Each part keeps its wireframe greys as placed (a dark primary button, grey pictures), over the
  theme and the style remembered for its shape.

The palette follows the page someone is on, as [Logo pages](logo-pages.md) "The Logo palette" says
of the Logo category: its kind is Wireframe on a wireframe page, opening on **Elements**; Logo on a
logo page; Design on any other. A page added (by the + or the chooser) is a page moved onto, so
the palette turns with it. In Wireframe the palette leaves out **Concepts** and Components' **Devices** row (a
screen is built from its own parts, and the page is its device already); they come back in the
other kinds.

## Templates

Start Making Pages ([Template start](start-diagramming.md)) holds the blank wireframes in its **Blank Pages** group
and each flow under the category of what it is for ([Template categories](../008-canvas/canvas-and-palette.md#template-categories)):

- **Blank wireframes**, one empty wireframe page in a device, its kind already chosen: **Blank Phone
  Wireframe** (iPhone), **Blank Tablet Wireframe** (iPad), **Blank Website Wireframe** (Browser),
  **Blank Laptop Wireframe** and **Blank Watch Wireframe**.
- **Flows**, a row of wireframe pages, each named for its screen and laid out from a wireframe layout
  (`WIREFRAME_FLOWS` in `packages/templates/src/wireframe-flow-data.ts`), **linked so it plays in Prototype mode
  as it opens** ([Clickable prototypes](#clickable-prototypes)):

| Template                   | Device  | Screens                                               |
| -------------------------- | ------- | ----------------------------------------------------- |
| Mobile App Wireframe       | iPhone  | Onboarding, Sign In, Home, Product, Checkout          |
| Social App Wireframe       | iPhone  | Feed, Stories, Post, New Post, Notifications, Profile |
| Delivery App Wireframe     | iPhone  | Shop, Search, Item, Cart, Tracking                    |
| Travel App Wireframe       | iPhone  | Search, Results, Boarding Pass, Explore               |
| Ride App Wireframe         | iPhone  | Sign In, Where To, Your Ride, Updates                 |
| Music App Wireframe        | iPhone  | Browse, Search, Now Playing, Podcast                  |
| App Sign Up Wireframe      | iPhone  | Welcome, Sign Up, Verify, Permissions, Get Started    |
| Account Settings Wireframe | iPhone  | Profile, Edit Profile, Settings, Help                 |
| Class Booking Wireframe    | iPhone  | Studios, Class, Book, Booked                          |
| Website Wireframe          | Browser | Home, Pricing, Sign In                                |
| Launch Site Wireframe      | Browser | Home, Pricing, Sign Up, Verify, Welcome               |
| Online Store Wireframe     | Browser | Shop, Product, Cart, Checkout                         |
| Blog Wireframe             | Browser | Blog, Article, Contact                                |
| Company Site Wireframe     | Browser | Home, Team, Help, Contact                             |
| Web App Wireframe          | Laptop  | Overview, Orders, Settings                            |
| Project Tool Wireframe     | Laptop  | Board, Tasks, Calendar, Team                          |
| Team Inbox Wireframe       | Laptop  | Inbox, Conversation, Notifications, Settings          |
| Tablet App Wireframe       | iPad    | Discover, Messages, Profile                           |
| Video App Wireframe        | iPad    | Browse, Search, Watch, Profile                        |
| Watch App Wireframe        | Watch   | Glance, Today, Alert                                  |
| Fitness Watch Wireframe    | Watch   | Workout, Heart Rate, Timer, Weather                   |
| Watch Music Wireframe      | Watch   | Now Playing, Up Next                                  |

A flow only uses layouts made for its device's form: the watch layouts on a watch, the rest on a phone, tablet,
laptop or browser (`template-flows.test.ts` pins it).

### A flow's own words

A flow's screens are the layouts' screens in the flow's own words, so every screen reads as part of one product:

- **Its name**: a flow may name its product (`brand`), which stands for the layouts' "Your App" wherever it
  appears (the nav's brand, "Sign in to Your App").
- **Its copy**: a flow, or one of its screens, may change any of a layout's words (`copy`): a search for linen
  shirts becomes flights from London to Lisbon on the Travel App's Results, a photo gallery becomes albums on
  the Music App's Browse. A word the layout writes more than once takes the flow's words in turn. A screen's copy
  wins over its flow's.
- No screen reads as another app's (a travel search listing shirts, a ride's updates liking a photo), no placeholder
  stands where a real name, product or price fits ("Product Name"), the prices and totals of one flow agree from
  screen to screen, and no list repeats a row it already showed. Every word fits its box
  (`page-lint`'s `templates.test.ts` pins it for every template).
- **No two flows share their words**: each flow names its own product (no two brands alike) and writes its own
  headlines, body copy, messages and rows, so no screen reads like another template's with the name swapped (the
  Launch Site is Brightside, rooftop solar paid monthly, not the Website's team tool; the Company Site is Tidewater,
  payroll). The interface's own phrases (Forgot Password?, Continue with Google, the terms box) may repeat.
  `template-builders-wireframe-flows.test.ts` pins it: no two screens alike with the brand set aside, and no two
  screens of one layout sharing more than half of their sentences.

### A flow's links

Every flow opens linked, so pressing **Prototype** on a fresh template walks through it:

- **The next step**: each screen's obvious next-step controls are screen links to the screen they lead to
  (Continue, Sign In, a product or a result, Add to Cart, Checkout, a tab bar's or nav's entries), named in the
  flow's data by the control's words, or by its icon (`icon:arrow-left`).
- **Back**: a screen's back arrow is a back link, except after a flow's last step (an order placed, a class
  booked), where it goes to the flow's first screen, as the app would.
- **Transition**: **Slide** on a phone, tablet or watch, **Instant** (absent) in a browser or on a laptop.
- **Every screen is reached**: from the first screen, following the links reaches every other screen of the flow.
- **No dead ends**: every screen has a way out (a link onward or back), so a walk through Prototype never stops on
  a screen with nothing to press; a working tool's screens (the Project Tool's) each link every other.
- **The page ids** are the template's own (`page-1`, `page-2`, ...), which the template's pages keep wherever it is
  applied (the start, `/new`, an agent's tab), so a link never arrives broken.

The controls that come linked:

| Template                   | Comes linked                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Mobile App Wireframe       | Continue and Skip, Sign In, a product, Add to Cart, Pay, the back arrows                                             |
| Social App Wireframe       | Stories, a post, the bell, the tab bar, Your Story, Cancel and Post, a name to its profile, the Post's back arrow    |
| Delivery App Wireframe     | the search field, a product, the bag, Add to Cart, Checkout, the back arrows                                         |
| Travel App Wireframe       | Search Flights, a flight, Trips, the destination, My Trip, the back arrows                                           |
| Ride App Wireframe         | Sign In, Choose a Ride, Confirm Standard, an update, the Updates tab bar                                             |
| Music App Wireframe        | an album, Podcasts, Search, a song, Play, the back arrows                                                            |
| App Sign Up Wireframe      | Continue and Skip, Create Account, Verify, Continue, Plan Something, the tab bar's Profile, the back arrows          |
| Account Settings Wireframe | Edit Profile, the settings cog, Cancel and Save, Profile, Help, Home, the back arrow                                 |
| Class Booking Wireframe    | a studio, Book a Spot, Pay, Done, the back arrows                                                                    |
| Website Wireframe          | the nav's Pricing and brand, Log In, Get Started, Start Free, Choose, Start Trial, Sign In                           |
| Launch Site Wireframe      | the nav's Pricing and brand, Log In, Get a Quote, Check My Roof, See the Savings, the plans, the logo, See My Report |
| Online Store Wireframe     | a product, the nav's Shop, Add to Cart, Checkout, Pay                                                                |
| Blog Wireframe             | the featured post, the nav's Latest and About, the brand                                                             |
| Company Site Wireframe     | the nav's Team, Help and Contact, the brand, Book a Demo                                                             |
| Web App Wireframe          | the sidebar's and nav's entries, Recent Orders                                                                       |
| Project Tool Wireframe     | the sidebar's entries on Board and Tasks, a task, the Calendar's meetings, the Team page's nav                       |
| Team Inbox Wireframe       | a message, Reply, the sidebar's Mentions and Settings, the nav's entries, the Conversation's back arrow              |
| Tablet App Wireframe       | the nav's Messages and profile, the Profile screen's nav, the Messages back arrow                                    |
| Video App Wireframe        | Search, a video, a result, the nav's Home and profile                                                                |
| Watch App Wireframe        | the step count, Messages, Dismiss (back)                                                                             |
| Fitness Watch Wireframe    | the heart rate, the time, the run, Cancel (back)                                                                     |
| Watch Music Wireframe      | the song, Up Next (back)                                                                                             |

`template-builders-wireframe-flows.test.ts` pins the links: every named control is on its screen, every link names
one of the flow's screens and never its own, every back arrow is a back link, every screen is reached, and pressing
Continue on a fresh Mobile App Wireframe's Onboarding goes to Sign In.

## Export

- A wireframe page exports as its whole device: the frame, the screen with its content clipped to
  it, and the system bars over it. PNG and SVG are **transparent** outside the device's outline (a
  device mockup is placed over other things); a PDF page stays white. Page thumbnails,
  the Minimap and agents' previews draw the frame too.

## Inspect

A wireframe is handed to the people who build it. **Inspect** is how they read it: click any element
to see its size, position, the spacing round it, its colours, border, corners and text style, copy
them as CSS or as plain values, and export a picture of it, with nothing on the page able to change.

- **Where it is**: the **Inspect** button in the bottom-right cluster, joined after Contents in the
  pages strip, while the tab is a wireframe tab (its pages are wireframe pages). It is a canvas tool:
  pressed, it holds the canvas in Inspect until pressed again, Escape, or another tool (V, H). The
  command palette offers it too (**Inspect Tool**). It is offered for every role and on a phone.
- **A press selects, nothing else**: a press on an element selects it to inspect (a press on the
  canvas clears it). It never moves, resizes, turns or edits it, for an Editor too: no handles, no
  selection toolbars, a double-click opens no editor, and the keyboard acts as a Viewer's
  ([Share roles](../013-workspace/share-roles.md)). Elements wear the plain pointer.
- **Units**: points, the device's own (its CSS px, as [The devices](#the-devices) sizes them), so
  a value reads as the screen would build it. A position is from the top-left of the screen of the
  page the element is on; values are rounded to a tenth, a whole number written bare.

### The measurements on the canvas

- **Hover** outlines the element under the pointer.
- **Spacing to its neighbours**: with nothing else hovered, the selected element shows a measured line
  out from each side to the nearest edge on that side: the next element's facing edge (one that
  overlaps it across that side), the inner edge of an element it sits in, or else the screen's edge.
  Each line carries its distance in a pill.
- **Spacing between two**: hovering another element while one is selected measures between them:
  the gap across and the gap down when they stand apart, or the four insets when one sits within
  the other.
- Hovering with nothing selected shows the hovered element's spacing to its neighbours.
- The lines are chrome drawn over the canvas, the same at every zoom, never part of the design or
  an export; they are local, never sent to anyone.

### The Inspect panel

While Inspect is on, the **Inspect** panel is open: a mode panel ([Panel corner docking](panel-docking.md)),
homed bottom-right like the Format and Laser panels, its header carrying the `?` to its help article
([Contextual help links](../018-help/contextual-help-links.md)). With nothing selected it reads "Select an element
to see its size, spacing, colours and type."; with several, "<n> elements selected. Select one to
inspect it." With one, under the element's name (its kind, and its words when it has some):

- **Layout**: **W**, **H**, **X**, **Y**, then **Rotation** when turned and **Opacity** when less
  than 100%, in whole percent as it was set (25% reads 25%, and 99% is still shown); Copy CSS writes it as the
  same fraction (`opacity: 0.25;`).
- **Spacing**: **Top**, **Right**, **Bottom**, **Left**, the distances the canvas draws, each with
  what it is measured to (an element's kind, or **Screen**).
- **Colours**: **Fill** and **Border**, each a swatch and its hex, the colour the element is drawn in
  (its own, or the theme's when it keeps none); a part with none reads **None**.
  An element that paints its own body (a chart, an icon, a progress bar, a concept graphic, a stored tab window)
  sits in no box, so it has no **Border** or **Radius**; a chart, a Sankey, an icon and a tab window draw
  nothing in a fill either, so their **Fill** reads **None** too.
- **Border**: its **Width**, **Style** and **Radius** (the corners as drawn, a pill's half its height).
- **Text**, when it carries words: **Font**, **Size**, **Weight**, **Line Height**, **Colour** and
  **Align**.
- Every value copies on a press ("Copied" flashes on it). **Copy CSS** copies the element as CSS
  (`width`, `height`, `left`, `top`, `transform`, `opacity`, `background`, `border`,
  `border-radius`, `color`, `font-family`, `font-size`, `font-weight`, `line-height`,
  `text-align`, in px); **Copy Values** copies every value above as lines of `Name: value`.
- **Export**: **1x**, **2x**, **3x** and **PNG** / **SVG** download the element, with what sits
  within it, as a picture on a clear ground cut to its own box, at that scale (an SVG keeps its
  drawing and takes the scale as its size), named `<design> - <element>@<n>x.<ext>`.

### A link that opens with Inspect

- An editor address or share link carrying `inspect` (`/design/shared?s=<code>&inspect=1`) opens
  with Inspect on when its tab is a wireframe tab; on any other tab it is ignored.
- **Copy Inspect Link**, at the foot of the panel: a visitor copies the link they came in on, with
  `inspect`. The owner (and anyone who may share the design) copies the design's live **Viewer** link
  (one for every tab, or this tab's; never a Community post's public link) with `inspect`; with no
  Viewer link yet the Share dialog opens so one can be made, with the note "Make a Viewer link, then
  copy the Inspect link." A design kept in This Browser has no link to copy, so no button.

## Clickable prototypes

Status: built (Work Tracker 136): the stored links, their checks, how agents read and write them, setting them in
the editor (the Screen mode, the link handle and the link marker), Prototype mode and its share link, and the Flow
view. The help centre's **Clickable Prototypes** article (under Wireframe Pages,
`apps/help/app/pages/wireframe-pages/prototypes/page.mdx`) walks through them.

A wireframe tab's screens can be clicked through: any element on a wireframe page can link to another screen of
the same tab, and **Prototype mode** plays the screens one at a time, a press on a linked element going to its
screen. A team sketches the screens and walks through them, on a desktop or a phone, and shares the walk-through
as a link.

### Screen links

- A **screen link** is an element link of kind `page`: `{ kind: "page", pageId, transition? }`. `pageId` names a
  page of the element's own tab; a link never reaches another tab's page (a tab or element link does that).
- A **back link** is `{ kind: "back", transition? }`: it goes to the screen shown before, and on the first screen
  shown it does nothing.
- **Transition**: `instant` (the same as absent), `slide` (the new screen slides in from the right; a back link's
  slides in from the left) or `dissolve` (the new screen fades in over the old). Under reduced motion every
  transition is instant.
- They are element links like the others: one per element, any element kind that takes a link (an arrow
  included), set and cleared the same way, and stored on the element as an additive field. An older build
  reads an element with one as an element with a link it does not know, and draws it unchanged.
- A screen link on an element that is not on a wireframe page is kept and does nothing.

### Setting a link

Whoever may link the element (Share roles below) sets a screen link in either of two ways; anyone else sees the
marker but neither way in.

- **Pick from a menu**: **Link Element** on a wireframe tab opens on a **Screen** mode, first among the modes
  (Screen, External URL, Tab, Design), when the element has no link or a screen link. It holds:
  - the **transition**, a three-way choice (Instant, Slide, Dissolve) above the list, set to the element's own
    transition when it has a screen link and Instant otherwise; it applies to the row pressed next;
  - the tab's screens in order, each by its name or "Screen <n>", the screen the element sits on marked **This
    screen** and not pressable (a link to the screen already shown goes nowhere), the linked screen marked;
  - **Back**, "The screen shown before", below them.
    Pressing a row links the element and closes the menu, as the Tab mode's rows do. When the element's screen link
    is broken, a note above the list says "This link's screen was deleted. Pick another screen, or remove the link."
    **Remove link** clears any link, as before. A Participant, whose element menu has no Link Element, reaches the
    menu from the link handle or a broken marker on its own element, and sees the Screen mode alone.
- **Drag the link handle**: a single selected element on a wireframe page of a tab with two or more screens shows a
  small round **link handle** just outside its bottom-right corner, in the brand colour so it never reads as a
  quick-connect plus. Dragging it draws a line from the handle to the pointer and outlines the screen under the
  pointer with its name; letting go on another screen links the element to it (keeping the element's transition
  when it already had a screen link), and letting go on the element's own screen, off every screen, or pressing
  Escape changes nothing. The screen's name pill sits above the screen's top-left corner, and is kept inside the
  window (8 px from its edges) when that corner is off screen. A press without a drag (or Enter on the focused handle) opens Link Element on its Screen
  mode. The handle hides while the element is being edited, while a menu covers it, on a locked tab and for
  anyone who may not link it.
- A linked element shows a small **link marker** while editing (its [element indicator](../008-canvas/element-indicators.md)):
  a screen with an arrow, which names the screen on hover ("Goes to Checkout", "Goes back to the screen before").
  Pressing it brings that screen into view on the canvas, as its label does; it never plays the prototype. A
  **broken** link's marker is the same screen with a broken arrow, in a warning red at full strength, and reads
  "Broken link: its screen was deleted"; pressing it opens Link Element on its Screen mode for whoever may link the
  element, and does nothing for anyone else.

### A link to a deleted page

Deleting a page leaves the links to it in place, so undoing the delete brings them back whole. A screen link
whose page is not on the tab is **broken**: it reads as broken everywhere it shows (the marker, the menu, the
Flow view and what agents read), does nothing when pressed, and never stops the tab loading, drawing, saving or
exporting. Linking the element again, or clearing its link, mends it.

### Prototype mode

- **Prototype** in the header's actions (a play glyph over the word, before Share or Copy), on a wireframe tab, for
  every role, plays the tab: one screen at a time, inside its device frame, centred and scaled to fit the window
  below a slim bar, over a plain backdrop. It starts on the screen in view (the first screen when none is). Its hover
  card says "Click through this tab's screens, as the people using them would."
- **The bar** reads **Prototype**, the screen's name and its place ("Checkout · 3 of 5"), and holds **Previous**
  and **Next** (chevrons, disabled at the ends), **Copy Prototype Link** (where there is a link to copy) and
  **Close** (an ×).
- Pressing a linked element (a **hotspot**) follows its link with its transition: a screen link goes to its screen,
  a back link to the screen shown before (nothing on the first screen shown). A broken link is no hotspot. A
  hotspot is the element's drawn box, cut to the screen; a press on the topmost hotspot under the pointer wins. The
  pointer is a hand over a hotspot.
- A press anywhere else on the stage **flashes the hotspots** on the screen: each lights in the brand colour (a
  soft fill and an outline), holds half a second and fades, so a person can see what is clickable.
- **Transitions** take 250 ms: Slide moves the new screen in from the right over the old one, which shifts a third
  of the way left and dims (a back link's slide runs the other way); Dissolve fades the new screen in over the old.
  Under reduced motion (the system's setting or Reduce Motion in Settings) every change is instant.
- **Keys**: the arrow keys (Left, Right) step through the screens in the tab's order, as Previous and Next do; Tab
  moves between the hotspots and the bar's controls, and Enter or Space on a hotspot follows it; Escape (or
  **Close**) returns to the editor, framing the screen last shown. While the player is open the editor's own
  shortcuts are held off.
- Nothing in Prototype mode edits: it is a player. It draws the screens live, so a collaborator's edit shows as it
  lands; when the screen shown is deleted the player moves to the first screen, and when the tab stops being a
  wireframe tab it closes.
- A screen is drawn as an export draws it: the frame, the content cut to the screen, the system bars over it.
- A screen's typefaces come from the page, never from the screen's own markup: the editor's one webfonts stylesheet is
  already linked in every route (a direct share-link open too), and the display faces its elements use are linked once
  by the player as the canvas links them, so each font is requested once. The screen drops the export's `@import` of the
  same stylesheet.

### Sharing a prototype

- A share link with `prototype` (`/design/shared?s=<code>&prototype=1`) opens straight into Prototype mode when its
  tab is a wireframe tab; on any other tab it is ignored. The editor reads the flag once as the design opens, as it
  reads `inspect`; the link is an ordinary share link and nothing about it is stored. Closing the player leaves the
  visitor in the editor with the link's role.
- **Copy Prototype Link** in the player's bar copies a link with `prototype`, as Copy Inspect Link does: a visitor the
  link they came in on; the owner (and anyone who may share) the design's live **Viewer** link (no Viewer link yet
  opens the Share dialog with "Make a Viewer link, then copy the Prototype link."); a design kept in This Browser has
  no link, so no button. It says "Copied a link that opens the prototype".
- On a phone the prototype fills the screen: the device frame steps aside and the screen alone fills the viewport
  (letterboxed on black where its shape differs), the bar shrinks to a small floating pill at the top (Previous, the
  place, Next, Close), and a tap follows a link.
- **Safe areas on a phone.** While it is open the player goes edge to edge (the page takes `viewport-fit=cover`, and
  gives it back on close), so the black runs under the notch or Dynamic Island, the home indicator and Safari's bars,
  while what a person reads and presses stays clear of them: the screen fits inside the device's safe-area insets on
  every side (portrait and landscape), and the pill sits 8 px from the top or below the top inset, whichever is lower,
  and clear of a landscape notch.

### Flow view

**Flow view** draws the prototype's map on the canvas: an arrow from each linked element to the screen it goes to,
so a team sees every path through the screens at once while it edits them.

- **Turning it on**: **Flow** in the bottom-right cluster, joined after Inspect in the pages strip while the tab is a
  wireframe tab, for every role and on a phone. It is a toggle: pressed while the view is on (its accessible name
  **Flow View**, its hover card "Draw an arrow from each linked element to the screen it goes to."). The command
  palette offers it too (**Show Flow View** / **Hide Flow View**). It stays on in this browser tab until turned off,
  never remembered past a reload and never sent to anyone; on a tab that is not a wireframe tab, and in Zen, nothing
  is drawn, and the arrows come back on returning while it is on.
- **What it draws**: each linked element's box (cut to its screen) outlined in the brand colour over a soft fill, and:
  - a **screen link** to the screen beside it (no screen between them): a curve from the side of the box facing that
    screen across the gap, entering the screen's near edge at the element's height (kept 24 px inside the screen's
    top and bottom), an arrowhead at the screen;
  - a screen link to a screen further along: a line out of the box's facing side to the gap beside its screen, up
    that gap (on its own screen's side of the gap's middle, so arcs leaving the two screens either side of one gap
    never share its column), over the row of screens (clear of their labels, higher the more screens it passes, and a
    lane higher again, up to four, where an earlier arc already runs over any of the same screens, so arcs never lie
    on one another short of a crowd of them over one stretch), down the gap beside the target on the target's side
    (clear of the arcs rising in that gap), and into the target's near side just below its top, with rounded corners
    and an arrowhead pointing into it, so it never crosses a screen it passes, nor the target's label and toolbar
    above it. Arcs into one side of a screen nest: the one on the higher lane drops nearest the screen and enters
    highest, the next one out and a step lower, so they never cross one another;
  - a **back link**: the outline and a small **Back** tag beside the box, no arrow (where it goes depends on the walk);
  - a **broken** link: the outline dashed and in the warning red (dashed too, since the brand is a red), a short
    dashed stub out of the box's side and a **Broken** tag at its end, in the same red, never an arrow to
    anywhere;
  - a tag (Back or Broken, with its stub) sits on the box's right, or on its left where the right would cover an
    arrow's run (one rising or dropping in a gap, entering a screen, or crossing to the screen beside) and the left
    would not, so a tag never hides where an arrow goes;
  - a link to the screen the element is on: the outline alone (it goes nowhere).
- The strokes are 2 px at every zoom, edged with the canvas colour so they read over busy screens, and the tags hold
  their size. Only visible elements count (not those on a hidden layer), and only those on a screen.
- The arrows are canvas chrome, never elements: they take no presses (everything under them works as usual), follow
  every edit as it lands (a moved element, a renamed or deleted screen), and are never part of an export, a thumbnail
  or what anyone else sees.

## Share roles

A wireframe page is a page: an **Editor** chooses its device, orientation, frame look and system
bars, places layouts and edits what is on it; a **Participant** may change what is on it as on any
page and never the device; a **Viewer** sees it, never the Frame button, the popover or the
panel. Every control is gated on the session's `can` (`can.editPages` for the device), as every
page control is.

**Inspect** is every role's (`can.inspect`, true for all three): an Editor, a Participant and a Viewer
alike may turn it on, select any element, read and copy its values and export its pictures (a
Viewer's export, as [Share roles](../013-workspace/share-roles.md) grants it). It writes nothing, and
while it is on an Editor's or Participant's presses and keys change nothing either. Copy Inspect Link
copies a link the session already holds, or, for whoever may share, the design's Viewer link; it never
makes a link.

**Screen links** are content on an element: an **Editor** sets, changes and clears them on any element; a
**Participant** on what it added itself, as it changes anything else about what it added (the participant
content rule, never on someone else's element); a **Viewer** never. **Prototype mode**, **Flow view** and a
prototype share link are every role's: they write nothing. Editors hold `can.linkScreens` for every element,
a Participant for its own unlocked elements, a Viewer for none; `can.playPrototype` is true for all three.

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
- Screen links are an element's `link` field: agents set one with `update_design` or an edit operation's `set`
  (`{"link": {"kind": "page", "pageId": "page-1a2b3c4d", "transition": "slide"}}`, `{"link": {"kind": "back"}}`) and
  read it in a view's attributes as `link=page:<pageId>` or `link=back`, with `transition=<slide|dissolve>` when not
  instant and `broken` when the page is not on the tab. The page ids are the ones the `pages` view prints. A
  malformed screen link (no `pageId`, an unknown transition) is refused naming the field.

## Telemetry

`Tab · Changed ·` `WireframePageAdded`, `PageKindWireframe` (the first page's choice);
`Tab · Changed · WireframeDevice<Iphone|IphoneDuo|Android|Ipad|AndroidTablet|Laptop|Desktop|Browser|Watch>`
(a device chosen, on adding or after); `Tab · Changed · WireframeFrame<Theme|Dark|Light|Outline>`;
`UI · Toggled · WireframeSystemBarsOn` / `WireframeSystemBarsOff`. Inspect: `Canvas · Used · Inspect`
(turned on); `UI · Copied · InspectCss` / `InspectValues` / `InspectValue` / `InspectLink`;
`Document · Exported · InspectPng` / `InspectSvg`. Never a name or text.
Prototypes: `Element · Linked · Screen` / `ScreenBack`; `Canvas · Used · Prototype` (played);
`UI · Copied · PrototypeLink`; `UI · Toggled · FlowViewOn` / `FlowViewOff`.

## Non-goals

- Links to another tab's screens, hover or timed triggers, and animated parts within a screen (a prototype
  goes from screen to screen on a press).
- Inspect generating platform code (SwiftUI, Compose, Tailwind) or measuring on other kinds of page.
- A device catalogue per model year, or custom screen sizes (a blank page in Fit to Content
  is the free-size page).
- Device photography or brand marks on the frame; the frames are drawn, generic and theme-neutral.
- Responsive re-layout of content when a device changes (it is re-fitted, not re-flowed).
