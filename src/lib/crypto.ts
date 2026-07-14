import type { Enc } from "./sync-schema";

/**
 * Client-side end-to-end encryption for backend sync (Web Crypto, AES-GCM).
 * The 256-bit key lives in a small file the user keeps wherever they choose;
 * the app holds it in memory for the session only and never writes it to
 * localStorage, IndexedDB, or the server. Losing the key file means the
 * synced ciphertext is unrecoverable — by design.
 */

const ALG = { name: "AES-GCM" } as const;

export async function generateKeyBytes(): Promise<Uint8Array> {
  const key = await crypto.subtle.generateKey({ ...ALG, length: 256 }, true, ["encrypt"]);
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}

export async function importKeyBytes(bytes: Uint8Array): Promise<CryptoKey> {
  if (bytes.byteLength !== 32) throw new Error("Key file must be exactly 32 bytes.");
  return crypto.subtle.importKey("raw", bytes as BufferSource, ALG, false, ["encrypt", "decrypt"]);
}

export function downloadKeyFile(bytes: Uint8Array): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "neurovim.key";
  a.click();
  URL.revokeObjectURL(url);
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function encryptText(key: CryptoKey, plaintext: string): Promise<Enc> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { ...ALG, iv: nonce },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { ct: toB64(ct), nonce: toB64(nonce) };
}

export async function decryptText(key: CryptoKey, enc: Enc): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { ...ALG, iv: fromB64(enc.nonce) as BufferSource },
    key,
    fromB64(enc.ct) as BufferSource,
  );
  return new TextDecoder().decode(pt);
}
