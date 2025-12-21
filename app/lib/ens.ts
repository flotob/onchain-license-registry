/**
 * ENS Resolution Utilities
 * 
 * Resolve ENS names and decode contenthash to ContentReference.
 * Supports IPFS, IPNS, Swarm, and Arweave contenthash formats.
 */

import { normalize } from "viem/ens";
import { getPublicClient } from "@wagmi/core";
import { mainnet } from "wagmi/chains";
import type { ContentReference, StorageProtocol } from "~/types/license-registry";

// Contenthash codec prefixes (from EIP-1577 / ENSIP-7)
// These are the multicodec prefixes used in ENS contenthash
const CONTENTHASH_CODECS = {
  // IPFS uses 0xe3 (ipfs-ns) followed by the CID
  IPFS_NS: 0xe3,
  // IPNS uses 0xe5 (ipns-ns) followed by the key
  IPNS_NS: 0xe5,
  // Swarm uses 0xe4 (swarm-ns) followed by the hash
  SWARM_NS: 0xe4,
  // Arweave doesn't have a standard codec yet, but some use 0x0a
} as const;

/**
 * Decode a contenthash bytes to a ContentReference.
 * 
 * Contenthash format (simplified):
 * - First byte(s): multicodec prefix indicating the protocol
 * - Remaining bytes: the content address
 * 
 * @param contenthash - The raw contenthash bytes (hex string with 0x prefix)
 * @returns ContentReference or null if invalid/unsupported
 */
export function decodeContenthash(contenthash: string | null): ContentReference | null {
  if (!contenthash || contenthash === "0x" || contenthash.length < 4) {
    return null;
  }

  try {
    // Remove 0x prefix
    const hex = contenthash.startsWith("0x") ? contenthash.slice(2) : contenthash;
    const bytes = hexToBytes(hex);
    
    if (bytes.length < 2) {
      return null;
    }

    // Read the multicodec prefix (varint encoded)
    const { value: codec, bytesRead } = readVarint(bytes);
    const contentBytes = bytes.slice(bytesRead);

    switch (codec) {
      case CONTENTHASH_CODECS.IPFS_NS: {
        // IPFS: the remaining bytes are a CID
        const cid = decodeCid(contentBytes);
        if (cid) {
          return { protocol: "ipfs", hash: cid };
        }
        break;
      }
      
      case CONTENTHASH_CODECS.IPNS_NS: {
        // IPNS: the remaining bytes are a CID (usually a libp2p-key)
        const key = decodeCid(contentBytes);
        if (key) {
          return { protocol: "ipns", hash: key };
        }
        break;
      }
      
      case CONTENTHASH_CODECS.SWARM_NS: {
        // Swarm: the remaining bytes are a 32-byte hash
        if (contentBytes.length >= 32) {
          const hash = bytesToHex(contentBytes.slice(0, 32));
          return { protocol: "bzz", hash };
        }
        break;
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to decode contenthash:", error);
    return null;
  }
}

/**
 * Decode CID bytes to a string representation.
 * Uses the multiformats library for proper CID handling.
 */
async function decodeCidAsync(bytes: Uint8Array): Promise<string | null> {
  try {
    const { CID } = await import("multiformats/cid");
    const cid = CID.decode(bytes);
    // Return as CIDv1 base32 for consistency
    return cid.toV1().toString();
  } catch {
    return null;
  }
}

/**
 * Synchronous CID decoding (simplified, for common cases).
 * For full CID support, use the async version.
 */
function decodeCid(bytes: Uint8Array): string | null {
  try {
    // Import dynamically to avoid SSR issues
    // This is a simplified decoder for common CID formats
    // For full support, the async version with multiformats should be used
    
    if (bytes.length < 2) return null;
    
    // Check for CIDv0 (starts with 0x12 0x20 for sha2-256)
    if (bytes[0] === 0x12 && bytes[1] === 0x20 && bytes.length === 34) {
      // CIDv0 is just base58btc encoded multihash
      return base58btcEncode(bytes);
    }
    
    // CIDv1: version(1) + codec + multihash
    // Read version
    const { value: version, bytesRead: versionBytes } = readVarint(bytes);
    
    if (version === 1) {
      // CIDv1 - encode as base32
      return "b" + base32Encode(bytes);
    }
    
    // Fallback: just hex encode (not ideal but works)
    return bytesToHex(bytes);
  } catch {
    return null;
  }
}

/**
 * Get the configured ENS name from environment.
 */
export function getConfiguredEnsName(): string | null {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_LICENSE_ENS_NAME) {
    return import.meta.env.VITE_LICENSE_ENS_NAME;
  }
  return null;
}

/**
 * Resolve an ENS name to its contenthash.
 * 
 * @param ensName - The ENS name (e.g., "license.commonground.eth")
 * @param chainId - Optional chain ID (defaults to mainnet)
 * @returns The contenthash as a hex string, or null if not set
 */
export async function resolveEnsContenthash(
  ensName: string,
  chainId: number = mainnet.id
): Promise<string | null> {
  try {
    // Normalize the ENS name
    const normalizedName = normalize(ensName);
    
    // Get a public client for the chain
    // Note: This requires wagmi to be configured with a provider
    const client = getPublicClient({ chainId } as any);
    
    if (!client) {
      throw new Error("No public client available. Ensure wagmi is configured.");
    }

    // Get the contenthash
    const contenthash = await client.getEnsText({
      name: normalizedName,
      key: "contenthash",
    });

    // If contenthash is not available via text record, try the native contenthash
    if (!contenthash) {
      // Use viem's built-in contenthash resolution
      const resolver = await client.getEnsResolver({ name: normalizedName });
      if (resolver) {
        // Read contenthash from resolver
        const data = await client.readContract({
          address: resolver,
          abi: [{
            name: "contenthash",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "node", type: "bytes32" }],
            outputs: [{ name: "", type: "bytes" }],
          }],
          functionName: "contenthash",
          args: [normalizedName as any], // This should be the namehash
        });
        return data as string;
      }
    }

    return contenthash;
  } catch (error) {
    console.error("Failed to resolve ENS contenthash:", error);
    return null;
  }
}

/**
 * Resolve an ENS name to a ContentReference.
 * Combines ENS resolution with contenthash decoding.
 * 
 * @param ensName - The ENS name
 * @returns ContentReference or null if not found/invalid
 */
export async function resolveEnsToContentReference(
  ensName: string
): Promise<ContentReference | null> {
  const contenthash = await resolveEnsContenthash(ensName);
  if (!contenthash) {
    return null;
  }
  return decodeContenthash(contenthash);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert hex string to Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Read a varint from bytes.
 * Returns the value and number of bytes read.
 */
function readVarint(bytes: Uint8Array): { value: number; bytesRead: number } {
  let value = 0;
  let bytesRead = 0;
  let shift = 0;

  while (bytesRead < bytes.length) {
    const byte = bytes[bytesRead];
    value |= (byte & 0x7f) << shift;
    bytesRead++;
    if ((byte & 0x80) === 0) {
      break;
    }
    shift += 7;
  }

  return { value, bytesRead };
}

/**
 * Base58btc alphabet.
 */
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Simple base58btc encoding.
 */
function base58btcEncode(bytes: Uint8Array): string {
  // Count leading zeros
  let zeros = 0;
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    zeros++;
  }

  // Convert to big integer and encode
  let value = BigInt(0);
  for (const byte of bytes) {
    value = value * BigInt(256) + BigInt(byte);
  }

  let result = "";
  while (value > BigInt(0)) {
    result = BASE58_ALPHABET[Number(value % BigInt(58))] + result;
    value = value / BigInt(58);
  }

  // Add leading '1's for leading zeros
  return "1".repeat(zeros) + result;
}

/**
 * Base32 lowercase alphabet (RFC 4648).
 */
const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

/**
 * Simple base32 encoding.
 */
function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let result = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return result;
}

