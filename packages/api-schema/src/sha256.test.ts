import { describe, expect, it } from 'vitest';
import { sha256Hex } from './sha256';

// sha256Hex is the load-bearing primitive for image dedup (spec/19):
// the live editor hashes bytes before POSTing them and stamps the
// digest on `X-Image-Sha256`; the api worker re-hashes the body and
// rejects any mismatch. If the hex encoding ever drifts (a missing
// leading-zero pad in bytesToHex, an uppercased character, a stray
// separator), every legitimate upload bounces with a hash mismatch.
// (Lived in apps/api until this package got its vitest harness.)
//
// Test vectors come from the SHA-256 reference suite (FIPS 180-4):
//   sha256("")    = e3b0c442…7852b855
//   sha256("abc") = ba7816bf…f20015ad (this one notably contains the
//                   bytes 0x01 and 0x03 in its digest, so the
//                   padding-with-zero branch of bytesToHex is
//                   implicitly exercised).

function bytesOf(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer as ArrayBuffer;
}

describe('sha256Hex', () => {
  it('returns the canonical FIPS digest for the empty input', async () => {
    const hex = await sha256Hex(new ArrayBuffer(0));
    expect(hex).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('returns the canonical FIPS digest for "abc"', async () => {
    // This vector is the standard NIST short-message test and the one
    // every cross-runtime SHA-256 implementation MUST round-trip: if
    // either side produces something different, image dedup breaks
    // silently the first time someone uploads a file. The digest
    // contains 0x01 and 0x03 as bytes, so a regression in bytesToHex's
    // leading-zero pad would drop a hex character from the output and
    // fail the 64-length invariant on the next test.
    const hex = await sha256Hex(bytesOf('abc'));
    expect(hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('returns the canonical FIPS digest for the 56-byte vector', async () => {
    // The 448-bit "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq" message:
    // crosses the 512-bit block boundary, so the padding / length-append
    // path is exercised. Locks in that the implementation handles multi-
    // block input the same as the reference, not just a single block.
    const hex = await sha256Hex(
      bytesOf('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    );
    expect(hex).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('always emits exactly 64 lowercase hex characters with no separator', async () => {
    // Format invariant: the api worker stores the digest in a TEXT
    // column whose comparison is case-sensitive, and the header echo
    // check is a literal string compare. Uppercase output, a 0x
    // prefix, or hyphenated octet groups would all silently break
    // dedup. Sweep several inputs so a single byte that happens to
    // exercise the padding branch doesn't mask a regression.
    for (const input of ['', 'a', 'abc', 'The quick brown fox jumps over the lazy dog']) {
      const hex = await sha256Hex(bytesOf(input));
      expect(hex).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('is deterministic for the same input bytes', async () => {
    // Two independent calls with byte-identical buffers must return
    // the same string. Catches a hypothetical regression that fed
    // a mutable state into the digest (e.g. accidentally reusing a
    // shared buffer the caller had since written to).
    const input = bytesOf('determinism');
    const a = await sha256Hex(input);
    const b = await sha256Hex(bytesOf('determinism'));
    expect(a).toBe(b);
  });

  it('distinguishes inputs that differ by a single byte', async () => {
    // Avalanche check: a one-byte change must move every part of the
    // digest. If the function ever short-circuited to a checksum on
    // empty/short inputs, this would catch it.
    const a = await sha256Hex(bytesOf('a'));
    const b = await sha256Hex(bytesOf('b'));
    expect(a).not.toBe(b);
  });
});
