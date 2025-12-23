/**
 * Storage Module
 * 
 * Factory and utilities for working with decentralized storage.
 * Currently supports IPFS, with Swarm support planned.
 */

import type { ContentReference, StorageProtocol } from "~/types/license-registry";
import type { StorageGateway } from "./types";
import { GatewayError } from "./types";
import { getIpfsGateway, IpfsGateway } from "./ipfs";

// Re-export types and utilities
export * from "./types";
export { IpfsGateway, getIpfsGateway, isValidCid, normalizeCid } from "./ipfs";

/**
 * Get a storage gateway for the given protocol.
 * 
 * @param protocol - The storage protocol
 * @returns The gateway instance
 * @throws Error if protocol is not supported
 */
export function getGateway(protocol: StorageProtocol): StorageGateway {
  switch (protocol) {
    case "ipfs":
    case "ipns":
      // IPNS uses the same gateways as IPFS
      return getIpfsGateway();
    
    case "ens":
      // ENS uses .limo gateway for resolution
      // This is a special case - not a real storage gateway
      throw new Error("ENS protocol requires direct gateway access, use getEnsGatewayUrl instead");
    
    case "bzz":
      // TODO: Implement Swarm gateway
      throw new Error("Swarm (bzz) protocol not yet implemented");
    
    case "ar":
      // TODO: Implement Arweave gateway
      throw new Error("Arweave (ar) protocol not yet implemented");
    
    default:
      throw new Error(`Unknown storage protocol: ${protocol}`);
  }
}

/**
 * Fetch content using a ContentReference.
 * Automatically selects the correct gateway based on protocol.
 * 
 * @param ref - The content reference
 * @returns The response from the gateway
 */
export async function fetchContent(ref: ContentReference): Promise<Response> {
  const gateway = getGateway(ref.protocol);
  return gateway.fetch(ref.hash);
}

/**
 * Fetch and parse JSON using a ContentReference.
 * 
 * @param ref - The content reference
 * @returns Parsed JSON data
 */
export async function fetchContentJson<T = unknown>(ref: ContentReference): Promise<T> {
  const gateway = getGateway(ref.protocol);
  return gateway.fetchJson<T>(ref.hash);
}

/**
 * Fetch text content using a ContentReference.
 * 
 * @param ref - The content reference
 * @returns Text content
 */
export async function fetchContentText(ref: ContentReference): Promise<string> {
  const gateway = getGateway(ref.protocol);
  return gateway.fetchText(ref.hash);
}

/**
 * Get the gateway URL for a ContentReference.
 * 
 * @param ref - The content reference
 * @returns Full URL to access the content
 */
export function getContentUrl(ref: ContentReference): string {
  // Special handling for ENS - use .limo gateway
  if (ref.protocol === "ens") {
    return `https://${ref.hash}.limo`;
  }
  
  const gateway = getGateway(ref.protocol);
  return gateway.getGatewayUrl(ref.hash);
}

/**
 * Validate a content hash for the given protocol.
 * 
 * @param protocol - The storage protocol
 * @param hash - The hash to validate
 * @returns True if valid
 */
export function isValidContentHash(protocol: StorageProtocol, hash: string): boolean {
  const gateway = getGateway(protocol);
  return gateway.isValidHash(hash);
}

/**
 * Get the configured storage protocol from environment.
 * Defaults to "ipfs".
 */
export function getConfiguredProtocol(): StorageProtocol {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_STORAGE_PROTOCOL) {
    const protocol = import.meta.env.VITE_STORAGE_PROTOCOL as string;
    if (["ipfs", "ipns", "bzz", "ar"].includes(protocol)) {
      return protocol as StorageProtocol;
    }
  }
  return "ipfs";
}

/**
 * Check if a protocol is currently supported.
 */
export function isProtocolSupported(protocol: StorageProtocol): boolean {
  switch (protocol) {
    case "ipfs":
    case "ipns":
    case "ens":
      return true;
    case "bzz":
    case "ar":
      return false; // Not yet implemented
    default:
      return false;
  }
}

// Re-export GatewayError for error handling
export { GatewayError };

