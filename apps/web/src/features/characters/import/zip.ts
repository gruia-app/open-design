// Minimal ZIP reader for pack import. Parses the central directory and
// inflates entries with the platform DecompressionStream — no dependency,
// streaming-friendly, and good enough for pack zips (stored + deflate).
// Entries decompress lazily so a fat zip only pays for what the pack uses.

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_EOCD_SEARCH = 22 + 0xffff; // EOCD record + max comment length

export interface ZipEntry {
  name: string;
  /** Compressed method: 0 = stored, 8 = deflate. */
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

export interface ZipArchive {
  entries: ZipEntry[];
  read(entry: ZipEntry): Promise<Uint8Array>;
}

function findEndOfCentralDirectory(view: DataView): number {
  const minOffset = Math.max(0, view.byteLength - MAX_EOCD_SEARCH);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

export function listZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) throw new Error('not a zip file (no end-of-central-directory)');
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) break;
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
    const name = (flags & 0x0800) !== 0
      ? decoder.decode(nameBytes)
      : decoder.decode(nameBytes); // cp437 edge cases are rare in pack zips
    entries.push({ name, method, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = entry.localHeaderOffset;
  if (view.getUint32(offset, true) !== LOCAL_SIGNATURE) {
    throw new Error(`zip entry "${entry.name}" has a corrupt local header`);
  }
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataStart = offset + 30 + nameLength + extraLength;
  const raw = bytes.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return new Uint8Array(raw);
  if (entry.method === 8) return inflate(new Uint8Array(raw));
  throw new Error(`zip entry "${entry.name}" uses unsupported method ${entry.method}`);
}

export function openZip(bytes: Uint8Array): ZipArchive {
  const entries = listZipEntries(bytes);
  return {
    entries,
    read: (entry) => readZipEntry(bytes, entry),
  };
}
