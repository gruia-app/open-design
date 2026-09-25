// Animated WebP muxer — wraps per-frame lossy WebP stills (produced by the
// browser's own `canvas.toBlob('image/webp')` encoder) in the WebP animation
// container: RIFF WEBP + VP8X + ANIM + one ANMF per frame. Pure byte
// manipulation — unit-testable without a DOM.

export interface EncodedFrame {
  /** A complete still WebP file (RIFF WEBP containing VP8 or VP8L). */
  bytes: Uint8Array;
  delayMs: number;
}

function u24(view: DataView, offset: number, value: number): void {
  view.setUint8(offset, value & 0xff);
  view.setUint8(offset + 1, (value >> 8) & 0xff);
  view.setUint8(offset + 2, (value >> 16) & 0xff);
}

function chunk(fourcc: string, payload: Uint8Array): Uint8Array {
  const padded = payload.length + (payload.length % 2);
  const out = new Uint8Array(8 + padded);
  out.set([fourcc.charCodeAt(0), fourcc.charCodeAt(1), fourcc.charCodeAt(2), fourcc.charCodeAt(3)], 0);
  new DataView(out.buffer).setUint32(4, payload.length, true);
  out.set(payload, 8);
  return out;
}

/** Extract the image chunks a still WebP contributes to an ANMF frame:
 *  the VP8/VP8L bitstream, preceded by its ALPH chunk when the still was
 *  wrapped in VP8X (Chromium emits lossy WebP with alpha as VP8X+ALPH+VP8).
 *  Chunk padding is preserved so the payload can be concatenated verbatim. */
export function extractFrameData(webp: Uint8Array): { image: Uint8Array; hasAlpha: boolean } {
  if (
    webp.length < 20
    || webp[0] !== 0x52 || webp[1] !== 0x49 || webp[2] !== 0x46 || webp[3] !== 0x46 // RIFF
    || webp[8] !== 0x57 || webp[9] !== 0x45 || webp[10] !== 0x42 || webp[11] !== 0x50 // WEBP
  ) {
    throw new Error('frame encoder did not produce a WebP file');
  }
  const view = new DataView(webp.buffer, webp.byteOffset, webp.byteLength);
  let offset = 12;
  let alpha: Uint8Array | null = null;
  let image: Uint8Array | null = null;
  while (offset + 8 <= webp.length) {
    const tag = String.fromCharCode(webp[offset]!, webp[offset + 1]!, webp[offset + 2]!, webp[offset + 3]!);
    const size = view.getUint32(offset + 4, true);
    const end = offset + 8 + size + (size % 2);
    if (tag === 'ALPH' && !alpha) alpha = webp.subarray(offset, end);
    if ((tag === 'VP8 ' || tag === 'VP8L') && !image) image = webp.subarray(offset, end);
    offset = end;
  }
  if (!image) throw new Error('no VP8/VP8L chunk inside the encoded WebP frame');
  return {
    image: alpha ? concat([alpha, image]) : image,
    hasAlpha: alpha !== null,
  };
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

/** Mux already-encoded WebP stills into an animated WebP file. */
export function muxAnimatedWebp(
  frames: EncodedFrame[],
  width: number,
  height: number,
  loopCount = 0,
): Uint8Array {
  if (frames.length === 0) throw new Error('nothing to mux — no frames');
  const parts: Uint8Array[] = [];

  const frameData = frames.map((frame) => extractFrameData(frame.bytes));
  const hasAlpha = frameData.some((data) => data.hasAlpha);

  const vp8x = new Uint8Array(10);
  const vp8xView = new DataView(vp8x.buffer);
  // animation flag (bit 1) + alpha flag (bit 4) when frames carry ALPH.
  vp8xView.setUint8(0, 0x02 | (hasAlpha ? 0x10 : 0x00));
  u24(vp8xView, 4, width - 1);
  u24(vp8xView, 7, height - 1);
  parts.push(chunk('VP8X', vp8x));

  const anim = new Uint8Array(6);
  const animView = new DataView(anim.buffer);
  animView.setUint32(0, 0xffffffff, true); // background BGRA — unused, full-frame
  animView.setUint16(4, loopCount, true); // 0 = loop forever
  parts.push(chunk('ANIM', anim));

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]!;
    const imageChunk = frameData[index]!.image;
    const header = new Uint8Array(16);
    const hview = new DataView(header.buffer);
    // x/y offsets (÷2 units) — always 0: frames are full-canvas.
    u24(hview, 0, 0);
    u24(hview, 3, 0);
    u24(hview, 6, width - 1);
    u24(hview, 9, height - 1);
    u24(hview, 12, Math.max(0, Math.round(frame.delayMs)));
    hview.setUint8(15, 0x00); // no blending needed: frames are opaque full-size
    const paddedImage = imageChunk.length % 2 === 0
      ? imageChunk
      : (() => {
          const p = new Uint8Array(imageChunk.length + 1);
          p.set(imageChunk, 0);
          return p;
        })();
    const payload = new Uint8Array(header.length + paddedImage.length);
    payload.set(header, 0);
    payload.set(paddedImage, header.length);
    parts.push(chunk('ANMF', payload));
  }

  const body = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(12 + body);
  out.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  new DataView(out.buffer).setUint32(4, 4 + body, true); // RIFF size
  out.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  let cursor = 12;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}
