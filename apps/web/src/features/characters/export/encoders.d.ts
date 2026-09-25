// Type shims for the untyped encoder deps used by the animation exporters.
// Signatures match the documented API surface — keep them minimal.

declare module 'gifenc' {
  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        delay?: number;
        transparent?: boolean;
        transparentIndex?: number;
        dispose?: number;
        repeat?: number;
        first?: boolean;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
  }
  export function GIFEncoder(opts?: {
    auto?: boolean;
    initialCapacity?: number;
  }): GIFEncoderInstance;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: string },
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array;
}

declare module 'upng-js' {
  const UPNG: {
    encode(
      frames: Array<Uint8Array | Uint8ClampedArray | ArrayBuffer>,
      width: number,
      height: number,
      cnum: number,
      delays?: number[],
    ): ArrayBuffer;
  };
  export default UPNG;
}
