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
