// A translucent wash of an element's OWN text colour.
//
// Every chip, track, rule and texture on a Behaviours card is derived from
// `textColor` rather than written as `bg-black/6 dark:bg-white/10`. Those
// Tailwind pairs follow the APP's dark mode, and an element's colours come
// from the TAB theme (docs/specs/011-theme/multicolour-themes.md) — so a dark card on a light-mode editor got
// black-on-dark chips that vanished, and a light card in dark mode got the
// opposite. Tying them to the text colour makes every part of a card agree
// with the card, whichever way either setting is pointed.
//
// It lives in lib/ rather than beside any one family's faces because it is
// shared: a helper reached from one family's folder is a dependency pointing
// the wrong way.

// The wash itself is the shared colorWash (@livedocuments/document), which the
// headless export uses too, so a chair's seat or a card's chip washes the
// same in an exported image.
export { colorWash as tint } from '@livedocuments/document';
