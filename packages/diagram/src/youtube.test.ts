import { describe, expect, it } from 'vitest';
import { youtubeEmbedUrl, youtubePosterUrl, youtubeVideoId, youtubeWatchUrl } from './youtube';

// A real-shaped id: 11 chars of the URL-safe base64 alphabet, including both
// of the non-alphanumeric ones so the character class is actually exercised.
const ID = 'dQw4w9Wg-_A';

describe('youtubeVideoId', () => {
  it('reads the watch form', () => {
    expect(youtubeVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it('ignores other query parameters around v', () => {
    expect(youtubeVideoId(`https://www.youtube.com/watch?list=PL123&v=${ID}&t=42s`)).toBe(ID);
  });

  it('reads the youtu.be short form', () => {
    expect(youtubeVideoId(`https://youtu.be/${ID}`)).toBe(ID);
    expect(youtubeVideoId(`https://youtu.be/${ID}?t=30`)).toBe(ID);
  });

  it('reads the embed, shorts, live and /v/ forms', () => {
    expect(youtubeVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(youtubeVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(youtubeVideoId(`https://www.youtube.com/live/${ID}`)).toBe(ID);
    expect(youtubeVideoId(`https://www.youtube.com/v/${ID}`)).toBe(ID);
  });

  it('accepts the alternate hosts people actually paste', () => {
    for (const host of [
      'youtube.com',
      'm.youtube.com',
      'music.youtube.com',
      'www.youtube-nocookie.com',
      'youtube-nocookie.com',
    ]) {
      expect(youtubeVideoId(`https://${host}/watch?v=${ID}`), host).toBe(ID);
    }
  });

  it('is case-insensitive about the host but not the id', () => {
    expect(youtubeVideoId(`https://WWW.YouTube.com/watch?v=${ID}`)).toBe(ID);
    // The id is case-SENSITIVE — lowercasing it would point at a different
    // video, or none.
    expect(youtubeVideoId('https://www.youtube.com/watch?v=DQW4W9WG-_A')).toBe('DQW4W9WG-_A');
  });

  it('accepts http as well as https', () => {
    expect(youtubeVideoId(`http://youtu.be/${ID}`)).toBe(ID);
  });

  it('returns null for a non-YouTube host carrying a v parameter', () => {
    // The whole point of checking the host first: somebody else's page can
    // have a `?v=` too, and it is not a video.
    expect(youtubeVideoId(`https://example.com/watch?v=${ID}`)).toBeNull();
    expect(youtubeVideoId(`https://notyoutube.com/watch?v=${ID}`)).toBeNull();
  });

  it('returns null for a lookalike host', () => {
    // A suffix match would let evil-youtube.com through.
    expect(youtubeVideoId(`https://evil-youtube.com/watch?v=${ID}`)).toBeNull();
    expect(youtubeVideoId(`https://youtube.com.evil.test/watch?v=${ID}`)).toBeNull();
  });

  it('returns null for a dangerous scheme even when the text looks right', () => {
    expect(youtubeVideoId(`javascript:https://youtu.be/${ID}`)).toBeNull();
    expect(youtubeVideoId(`data:text/html,https://youtu.be/${ID}`)).toBeNull();
  });

  it('returns null for an id of the wrong length or alphabet', () => {
    expect(youtubeVideoId('https://youtu.be/tooshort')).toBeNull();
    expect(youtubeVideoId('https://youtu.be/waaaaaaaaaaytoolong')).toBeNull();
    // 11 characters, but '+' is not in the URL-safe alphabet.
    expect(youtubeVideoId('https://youtu.be/dQw4w9Wg+_A')).toBeNull();
  });

  it('returns null for a YouTube URL that is not a video', () => {
    expect(youtubeVideoId('https://www.youtube.com/')).toBeNull();
    expect(youtubeVideoId('https://www.youtube.com/results?search_query=cats')).toBeNull();
    expect(youtubeVideoId('https://www.youtube.com/@somechannel')).toBeNull();
  });

  it('returns null for junk, empty and missing input', () => {
    expect(youtubeVideoId('not a url at all')).toBeNull();
    expect(youtubeVideoId('')).toBeNull();
    expect(youtubeVideoId(undefined)).toBeNull();
    expect(youtubeVideoId(null)).toBeNull();
  });

  it('tolerates surrounding whitespace from a paste', () => {
    expect(youtubeVideoId(`  https://youtu.be/${ID}\n`)).toBe(ID);
  });
});

describe('url builders', () => {
  it('builds a poster on the static image host', () => {
    expect(youtubePosterUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
  });

  it('builds the player on the no-cookie origin', () => {
    // The no-cookie origin is the privacy contract in spec/114; a regression
    // to www.youtube.com here would silently start setting cookies.
    const embed = youtubeEmbedUrl(ID);
    expect(embed.startsWith('https://www.youtube-nocookie.com/embed/')).toBe(true);
    expect(embed).toContain('autoplay=1');
  });

  it('builds the canonical watch url', () => {
    expect(youtubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });
});
