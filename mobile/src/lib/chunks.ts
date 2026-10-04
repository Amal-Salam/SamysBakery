// Pure helpers for storing values larger than a secure-storage entry allows
// (unit tested). SecureStore keys may only contain letters, digits, ".", "-", "_".

export const CHUNK_SIZE = 1800;

export function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function chunkKey(key: string, index: number): string {
  return `${safeKey(key)}.${index}`;
}

export function countKey(key: string): string {
  return `${safeKey(key)}.count`;
}

export function splitIntoChunks(value: string, size = CHUNK_SIZE): string[] {
  if (value.length === 0) return [""];
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) chunks.push(value.slice(i, i + size));
  return chunks;
}
