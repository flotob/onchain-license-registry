/**
 * Storage Abstraction Types
 * 
 * Interfaces for decentralized storage gateways.
 * Allows the application to work with IPFS, Swarm, Arweave, etc.
 */

import type { ContentReference, StorageProtocol } from "~/types/license-registry";

/**
 * Configuration for a storage gateway.
 */
export interface GatewayConfig {
  /** Base URL of the gateway */
  url: string;
  /** Optional timeout in milliseconds */
  timeout?: number;
}

/**
 * Interface for storage gateway implementations.
 * Each protocol (IPFS, Swarm, etc.) implements this interface.
 */
export interface StorageGateway {
  /** The protocol this gateway handles */
  readonly protocol: StorageProtocol;
  
  /** List of gateway URLs (in fallback order) */
  readonly gateways: string[];

  /**
   * Fetch content from the storage network.
   * Tries multiple gateways with fallback on failure.
   * 
   * @param hash - The content hash (CID for IPFS, hash for Swarm, etc.)
   * @returns The response from the gateway
   */
  fetch(hash: string): Promise<Response>;

  /**
   * Fetch content and parse as JSON.
   * 
   * @param hash - The content hash
   * @returns Parsed JSON data
   */
  fetchJson<T = unknown>(hash: string): Promise<T>;

  /**
   * Fetch content as text.
   * 
   * @param hash - The content hash
   * @returns Text content
   */
  fetchText(hash: string): Promise<string>;

  /**
   * Get the gateway URL for a given hash.
   * Returns the first (primary) gateway URL.
   * 
   * @param hash - The content hash
   * @returns Full URL to access the content
   */
  getGatewayUrl(hash: string): string;

  /**
   * Validate a content hash format.
   * 
   * @param hash - The hash to validate
   * @returns True if the hash format is valid
   */
  isValidHash(hash: string): boolean;
}

/**
 * Result of a fetch operation with metadata.
 */
export interface FetchResult<T> {
  /** The fetched data */
  data: T;
  /** The gateway URL that succeeded */
  gateway: string;
  /** Response headers (if available) */
  headers?: Record<string, string>;
}

/**
 * Error thrown when all gateways fail.
 */
export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly protocol: StorageProtocol,
    public readonly hash: string,
    public readonly attemptedGateways: string[],
    public readonly errors: Error[]
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

/**
 * Options for fetching content.
 */
export interface FetchOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to throw on non-2xx responses (default: true) */
  throwOnError?: boolean;
}

/**
 * Helper to create a ContentReference from protocol and hash.
 */
export function createContentReference(
  protocol: StorageProtocol,
  hash: string
): ContentReference {
  return { protocol, hash };
}

/**
 * Helper to format a ContentReference as a URI string.
 * e.g., "ipfs://bafybeig..." or "bzz://abc123..."
 */
export function formatContentUri(ref: ContentReference): string {
  return `${ref.protocol}://${ref.hash}`;
}

/**
 * Helper to parse a content URI string into a ContentReference.
 * e.g., "ipfs://bafybeig..." → { protocol: "ipfs", hash: "bafybeig..." }
 */
export function parseContentUri(uri: string): ContentReference | null {
  const match = uri.match(/^(ipfs|ipns|bzz|ar):\/\/(.+)$/);
  if (!match) return null;
  return {
    protocol: match[1] as StorageProtocol,
    hash: match[2],
  };
}

