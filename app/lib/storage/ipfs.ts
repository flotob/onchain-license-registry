/**
 * IPFS Gateway Implementation
 * 
 * Multi-gateway IPFS fetcher with fallback support.
 * Uses public gateways to fetch content by CID.
 */

import { CID } from "multiformats/cid";
import type { StorageGateway, FetchOptions } from "./types";
import { GatewayError } from "./types";

/**
 * Default IPFS gateways in fallback order.
 */
const DEFAULT_IPFS_GATEWAYS = [
  "https://dweb.link",
  "https://w3s.link", 
  "https://cloudflare-ipfs.com",
  "https://ipfs.io",
];

/**
 * Default timeout for gateway requests (30 seconds).
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Parse gateway URLs from environment variable.
 */
function getGatewaysFromEnv(): string[] {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_IPFS_GATEWAYS) {
    return import.meta.env.VITE_IPFS_GATEWAYS.split(",").map((g: string) => g.trim());
  }
  return DEFAULT_IPFS_GATEWAYS;
}

/**
 * IPFS Storage Gateway implementation.
 */
export class IpfsGateway implements StorageGateway {
  readonly protocol = "ipfs" as const;
  readonly gateways: string[];
  private readonly timeout: number;

  constructor(gateways?: string[], timeout?: number) {
    this.gateways = gateways ?? getGatewaysFromEnv();
    this.timeout = timeout ?? DEFAULT_TIMEOUT;
  }

  /**
   * Validate an IPFS CID.
   */
  isValidHash(hash: string): boolean {
    try {
      CID.parse(hash);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the primary gateway URL for a CID.
   */
  getGatewayUrl(hash: string): string {
    const gateway = this.gateways[0];
    return `${gateway}/ipfs/${hash}`;
  }

  /**
   * Build gateway URL for a specific gateway.
   */
  private buildUrl(gateway: string, hash: string, path?: string): string {
    const base = `${gateway}/ipfs/${hash}`;
    return path ? `${base}${path}` : base;
  }

  /**
   * Fetch content from IPFS with multi-gateway fallback.
   */
  async fetch(hash: string, path?: string, options?: FetchOptions): Promise<Response> {
    const timeout = options?.timeout ?? this.timeout;
    const errors: Error[] = [];

    for (const gateway of this.gateways) {
      const url = this.buildUrl(gateway, hash, path);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "Accept": "application/json, text/plain, */*",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(err);
        console.warn(`IPFS gateway ${gateway} failed for ${hash}:`, err.message);
        // Continue to next gateway
      }
    }

    throw new GatewayError(
      `All IPFS gateways failed for CID: ${hash}`,
      "ipfs",
      hash,
      this.gateways,
      errors
    );
  }

  /**
   * Fetch and parse JSON from IPFS.
   */
  async fetchJson<T = unknown>(hash: string, path?: string): Promise<T> {
    const response = await this.fetch(hash, path);
    return response.json() as Promise<T>;
  }

  /**
   * Fetch text content from IPFS.
   */
  async fetchText(hash: string, path?: string): Promise<string> {
    const response = await this.fetch(hash, path);
    return response.text();
  }

  /**
   * Fetch a file from within an IPFS directory.
   * 
   * @param dirHash - The CID of the directory
   * @param filePath - Path to the file within the directory (e.g., "/registry.json")
   */
  async fetchFromDir<T = unknown>(dirHash: string, filePath: string): Promise<T> {
    // Ensure path starts with /
    const normalizedPath = filePath.startsWith("/") ? filePath : `/${filePath}`;
    return this.fetchJson<T>(dirHash, normalizedPath);
  }

  /**
   * Fetch text file from within an IPFS directory.
   */
  async fetchTextFromDir(dirHash: string, filePath: string): Promise<string> {
    const normalizedPath = filePath.startsWith("/") ? filePath : `/${filePath}`;
    return this.fetchText(dirHash, normalizedPath);
  }
}

/**
 * Singleton IPFS gateway instance.
 */
let _ipfsGateway: IpfsGateway | null = null;

/**
 * Get the IPFS gateway instance.
 */
export function getIpfsGateway(): IpfsGateway {
  if (!_ipfsGateway) {
    _ipfsGateway = new IpfsGateway();
  }
  return _ipfsGateway;
}

/**
 * Validate an IPFS CID string.
 */
export function isValidCid(hash: string): boolean {
  try {
    CID.parse(hash);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse and normalize a CID to CIDv1 base32.
 */
export function normalizeCid(hash: string): string {
  try {
    const cid = CID.parse(hash);
    // Convert to CIDv1 with base32 encoding (recommended format)
    return cid.toV1().toString();
  } catch {
    return hash;
  }
}

