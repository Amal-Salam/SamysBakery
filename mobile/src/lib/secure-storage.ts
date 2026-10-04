import * as SecureStore from "expo-secure-store";

import { chunkKey, countKey, splitIntoChunks } from "./chunks";

// Supabase session storage backed by the Android Keystore (encrypted). Sessions
// can exceed what one secure entry may hold, so values are stored in chunks.
// Nothing about the session is ever written to unencrypted storage.

async function read(key: string): Promise<string | null> {
  const count = Number(await SecureStore.getItemAsync(countKey(key)));
  if (!Number.isInteger(count) || count <= 0) return null;
  const parts = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))));
  if (parts.some((part) => part === null)) return null;
  return parts.join("");
}

async function remove(key: string): Promise<void> {
  const count = Number(await SecureStore.getItemAsync(countKey(key)));
  await SecureStore.deleteItemAsync(countKey(key));
  if (Number.isInteger(count) && count > 0) {
    await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))));
  }
}

async function write(key: string, value: string): Promise<void> {
  await remove(key);
  const chunks = splitIntoChunks(value);
  await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)));
  await SecureStore.setItemAsync(countKey(key), String(chunks.length));
}

export const secureSessionStorage = {
  getItem: read,
  setItem: write,
  removeItem: remove,
};
