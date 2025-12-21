/**
 * SHA-256 Hashing Utilities
 * 
 * Uses the Web Crypto API for secure hashing in the browser.
 * Provides utilities for hashing strings, files, and ArrayBuffers.
 */

/**
 * Hash a string using SHA-256.
 * 
 * @param text - The text to hash
 * @returns Hex-encoded SHA-256 hash
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return sha256Bytes(data);
}

/**
 * Hash an ArrayBuffer or Uint8Array using SHA-256.
 * 
 * @param data - The data to hash
 * @returns Hex-encoded SHA-256 hash
 */
export async function sha256Bytes(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = data instanceof Uint8Array ? data.buffer : data;
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return arrayBufferToHex(hashBuffer);
}

/**
 * Hash a File object using SHA-256.
 * 
 * @param file - The file to hash
 * @returns Hex-encoded SHA-256 hash
 */
export async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return sha256Bytes(buffer);
}

/**
 * Hash a Blob using SHA-256.
 * 
 * @param blob - The blob to hash
 * @returns Hex-encoded SHA-256 hash
 */
export async function sha256Blob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return sha256Bytes(buffer);
}

/**
 * Verify that content matches an expected hash.
 * 
 * @param content - The content to verify (string or ArrayBuffer)
 * @param expectedHash - The expected SHA-256 hash (hex-encoded)
 * @returns True if the hash matches
 */
export async function verifyHash(
  content: string | ArrayBuffer | Uint8Array,
  expectedHash: string
): Promise<boolean> {
  const actualHash = typeof content === "string"
    ? await sha256(content)
    : await sha256Bytes(content);
  
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Compute hash of a file and return both the hash and file content.
 * Useful when you need both the content and its hash.
 * 
 * @param file - The file to process
 * @returns Object containing the hash and text content
 */
export async function hashFileWithContent(file: File): Promise<{
  hash: string;
  content: string;
  size: number;
}> {
  const buffer = await file.arrayBuffer();
  const hash = await sha256Bytes(buffer);
  const decoder = new TextDecoder();
  const content = decoder.decode(buffer);
  
  return {
    hash,
    content,
    size: file.size,
  };
}

/**
 * Compute hash of binary file content.
 * 
 * @param file - The file to process
 * @returns Object containing the hash and binary content
 */
export async function hashBinaryFile(file: File): Promise<{
  hash: string;
  content: ArrayBuffer;
  size: number;
  name: string;
  type: string;
}> {
  const buffer = await file.arrayBuffer();
  const hash = await sha256Bytes(buffer);
  
  return {
    hash,
    content: buffer,
    size: file.size,
    name: file.name,
    type: file.type,
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert ArrayBuffer to hex string.
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert hex string to Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Check if a string is a valid hex-encoded SHA-256 hash.
 * SHA-256 produces 32 bytes = 64 hex characters.
 */
export function isValidSha256(hash: string): boolean {
  const cleanHash = hash.startsWith("0x") ? hash.slice(2) : hash;
  return /^[a-fA-F0-9]{64}$/.test(cleanHash);
}

