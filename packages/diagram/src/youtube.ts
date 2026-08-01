// YouTube URL parsing for the video element (spec/114).
//
// Lives in the diagram package rather than the editor because both the canvas
// renderer and the export paths need to answer "is this link a video, and
// which one" from the same rules.
//
// The id is parsed on demand and never stored on the element: the link IS the
// truth, and a cached id would be a second copy of it that can drift. That is
// affordable here precisely because parsing is local and free — a link card
// caches its preview only because unfurling costs a network round trip
// (spec/40).

// YouTube ids are exactly 11 characters of the URL-safe base64 alphabet.
// Anchored, so a longer path segment that merely starts with 11 valid
// characters is rejected rather than truncated into a plausible-looking id.
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// Hosts that serve YouTube videos. `music.` and `m.` are the real
// alternates people paste; `-nocookie` shows up when someone copies an embed
// snippet back out of a page.
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);

// Path prefixes that carry the id as the NEXT segment.
const ID_BEARING_PREFIXES = ['embed', 'shorts', 'live', 'v'];

/**
 * The YouTube video id in `url`, or null if there isn't one.
 *
 * Returns null rather than throwing for junk input, so callers can treat "not
 * a video" and "not a URL at all" the same way — which is what the renderer
 * wants, since both show the same "not a YouTube link" state.
 */
export function youtubeVideoId(url: string | undefined | null): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  // Scheme check before anything else: a `javascript:` URL whose text happens
  // to contain a watch-shaped substring must not resolve to an id.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split('/').filter(Boolean);

  // youtu.be/<id> — the whole path is the id.
  if (SHORT_HOSTS.has(host)) {
    return validId(segments[0]);
  }

  if (!YOUTUBE_HOSTS.has(host)) return null;

  // The `?v=` form is only meaningful on a YouTube host, which is why the
  // host check sits above it: `example.com/watch?v=...` is somebody else's
  // page that happens to share a query-parameter name.
  const v = parsed.searchParams.get('v');
  if (v) return validId(v);

  const [first, second] = segments;
  if (first && ID_BEARING_PREFIXES.includes(first.toLowerCase())) {
    return validId(second);
  }
  return null;
}

function validId(candidate: string | undefined): string | null {
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

/**
 * The poster frame for a video id.
 *
 * `hqdefault` rather than `maxresdefault`: every video has one, whereas
 * maxres 404s for older and lower-resolution uploads, which would show a
 * broken card for exactly the videos least likely to be re-uploaded.
 */
export function youtubePosterUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * The player URL, mounted only once the user presses play (spec/114).
 *
 * `youtube-nocookie.com` sets nothing until playback actually starts, so
 * opening a diagram that contains a video is not a tracked visit.
 */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
}

/** The canonical watch page, for the "open on YouTube" affordance. */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// --- Other providers (spec/121) --------------------------------------------
//
// The video element was built YouTube-only (spec/114), and its own spec noted
// that the parser, the poster URL and the embed origin were the only
// YouTube-specific parts. This is those three, generalised.
//
// Everything below returns a plain embed URL and no poster: only YouTube
// publishes a predictable thumbnail host. Without one the card shows a
// provider chip and a Load button, which keeps the rule that matters — nothing
// third-party loads until the user asks.

export const EMBED_PROVIDERS = ['youtube', 'vimeo', 'loom', 'figma', 'gdocs', 'website'] as const;
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];

/** Display name for a provider, for the palette tile and the empty state. */
export const EMBED_PROVIDER_LABEL: Record<EmbedProvider, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  loom: 'Loom',
  figma: 'Figma',
  gdocs: 'Google Docs',
  website: 'Website',
};

/** What to type in the link dialog, per provider. */
export const EMBED_PROVIDER_HINT: Record<EmbedProvider, string> = {
  youtube: 'Watch, share (youtu.be), Shorts and embed links all work.',
  vimeo: 'A vimeo.com video link.',
  loom: 'A Loom share or embed link.',
  figma: 'Any Figma file, prototype or board link.',
  gdocs: 'A Google Doc, Sheet or Slides link you have shared.',
  website: 'Any https link. Some sites refuse to be framed and will come up blank.',
};

export type EmbedTarget = {
  provider: EmbedProvider;
  /** The URL to put in the iframe once the user presses play / load. */
  embedUrl: string;
  /** Poster frame, when the provider publishes one at a predictable URL. */
  posterUrl?: string;
  /** Display name for the card's chip. */
  label: string;
};

const VIMEO_ID = /^\/(?:video\/)?(\d{6,})/;
const LOOM_ID = /^\/(?:share|embed)\/([A-Za-z0-9]{16,})/;

/**
 * What, if anything, this URL embeds.
 *
 * YouTube first, because it has the richest matching (five URL shapes) and its
 * own dedicated parser; the rest are one pattern each.
 */
export function embedTargetFor(url: string | undefined | null): EmbedTarget | null {
  const videoId = youtubeVideoId(url);
  if (videoId) {
    return {
      provider: 'youtube',
      embedUrl: youtubeEmbedUrl(videoId),
      posterUrl: youtubePosterUrl(videoId),
      label: 'YouTube',
    };
  }
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const path = parsed.pathname;

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = VIMEO_ID.exec(path);
    if (m)
      return {
        provider: 'vimeo',
        embedUrl: `https://player.vimeo.com/video/${m[1]}`,
        label: 'Vimeo',
      };
    return null;
  }
  if (host === 'loom.com') {
    const m = LOOM_ID.exec(path);
    if (m)
      return { provider: 'loom', embedUrl: `https://www.loom.com/embed/${m[1]}`, label: 'Loom' };
    return null;
  }
  if (host === 'figma.com' || host === 'figma.site') {
    // Figma embeds the ORIGINAL url as a query parameter rather than
    // rewriting the path, so anything it accepts keeps working without this
    // having to know Figma's file-url grammar.
    return {
      provider: 'figma',
      embedUrl: `https://www.figma.com/embed?embed_host=livediagram&url=${encodeURIComponent(parsed.toString())}`,
      label: 'Figma',
    };
  }
  if (host === 'docs.google.com') {
    // /edit -> /preview is the documented read-only embed form for Docs,
    // Sheets and Slides alike.
    if (!/^\/(document|spreadsheets|presentation)\//.test(path)) return null;
    return {
      provider: 'gdocs',
      embedUrl: parsed.toString().replace(/\/(edit|view)(\?|#|$).*$/, '/preview'),
      label: 'Google Docs',
    };
  }
  // Anything else http(s) is a plain website embed: the URL goes into the
  // iframe untouched (spec/133).
  //
  // Deliberately the LAST branch, and deliberately not reached by a malformed
  // link for a provider we DO know: `vimeo.com/nonsense` still returns null
  // above, because "that isn't a Vimeo video" is a more useful answer than
  // silently framing a 404 page. Only hosts we have no opinion about land
  // here.
  //
  // The label is the host, not the word "Website": a card reading `bbc.co.uk`
  // says what it holds, and a row of three cards all labelled "Website" says
  // nothing at all.
  return {
    provider: 'website',
    embedUrl: parsed.toString(),
    label: host || 'Website',
  };
}
