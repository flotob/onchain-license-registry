/**
 * useRegistry Hook
 * 
 * Fetches and manages the license registry state.
 * Resolves ENS name → contenthash → registry.json (which contains all entries inline)
 */

import { useEffect, useState, useCallback } from "react";
import type {
  RegistryManifest,
  LicenseEntry,
  ContentReference,
  RegistryState,
  ChainVerificationResult,
  VerificationCheck,
} from "~/types/license-registry";
import { getIpfsGateway } from "~/lib/storage";
import { getConfiguredEnsName } from "~/lib/ens";
import { verifyHash } from "~/lib/hash";

/**
 * Resolve ENS name via .limo gateway.
 * The .limo gateway handles ENS → IPFS resolution for us.
 */
function getEnsGatewayUrl(ensName: string): string {
  return `https://${ensName}.limo`;
}

/**
 * Fetch JSON from ENS gateway with CORS handling.
 */
async function fetchFromEnsGateway<T>(ensName: string, path: string): Promise<T> {
  const baseUrl = getEnsGatewayUrl(ensName);
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  
  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(
          `CORS blocked by ENS gateway. Set VITE_REGISTRY_CID to use direct IPFS access.`
        );
      }
      throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `Network error fetching from ENS gateway. Set VITE_REGISTRY_CID for direct IPFS access.`
      );
    }
    throw error;
  }
}

/**
 * Fetch text from ENS gateway with CORS handling.
 */
export async function fetchTextFromEnsGateway(ensName: string, path: string): Promise<string> {
  const baseUrl = getEnsGatewayUrl(ensName);
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  
  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Accept': 'text/plain, text/markdown, */*',
      },
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(
          `CORS blocked by ENS gateway. Set VITE_REGISTRY_CID to use direct IPFS access.`
        );
      }
      throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `Network error fetching from ENS gateway. Set VITE_REGISTRY_CID for direct IPFS access.`
      );
    }
    throw error;
  }
}

/**
 * Result of the useRegistry hook.
 */
export interface UseRegistryResult {
  /** Current state of the registry */
  state: RegistryState;
  /** The full entry chain (newest to oldest) */
  entryChain: LicenseEntry[];
  /** Refresh the registry data */
  refresh: () => Promise<void>;
  /** The ENS name being used */
  ensName: string | null;
  /** The content reference (if resolved) */
  contentRef: ContentReference | null;
}

/**
 * Hook to fetch and manage the license registry.
 * 
 * @param ensNameOverride - Optional ENS name override (uses env var if not provided)
 * @param contentRefOverride - Optional content reference override (skips ENS resolution)
 */
export function useRegistry(
  ensNameOverride?: string,
  contentRefOverride?: ContentReference
): UseRegistryResult {
  const ensName = ensNameOverride ?? getConfiguredEnsName();
  const [state, setState] = useState<RegistryState>({ status: "loading" });
  const [entryChain, setEntryChain] = useState<LicenseEntry[]>([]);
  const [contentRef, setContentRef] = useState<ContentReference | null>(contentRefOverride ?? null);

  const fetchRegistry = useCallback(async () => {
    // If no ENS name and no content ref, show not found
    if (!ensName && !contentRefOverride) {
      setState({
        status: "error",
        error: "No ENS name configured. Set VITE_LICENSE_ENS_NAME environment variable.",
      });
      return;
    }

    setState({ status: "loading" });

    try {
      let manifest: RegistryManifest;
      
      // Check if we have a direct CID override (useful for development/testing)
      const directCid = import.meta.env.VITE_REGISTRY_CID;
      const useDirectCid = directCid && contentRefOverride === undefined;
      
      if (useDirectCid) {
        // Use direct IPFS gateway with the provided CID
        const ref: ContentReference = { protocol: "ipfs", hash: directCid };
        setContentRef(ref);
        
        const ipfs = getIpfsGateway();
        manifest = await ipfs.fetchFromDir<RegistryManifest>(ref.hash, "/registry.json");
      } else if (contentRefOverride) {
        // Use provided content reference with IPFS gateway
        setContentRef(contentRefOverride);
        
        const ipfs = getIpfsGateway();
        manifest = await ipfs.fetchFromDir<RegistryManifest>(contentRefOverride.hash, "/registry.json");
      } else if (ensName) {
        // Use ENS gateway (.limo) to resolve and fetch
        setContentRef({ protocol: "ens", hash: ensName });
        manifest = await fetchFromEnsGateway<RegistryManifest>(ensName, "/registry.json");
      } else {
        setState({ status: "not_found", ensName: "unknown" });
        return;
      }

      // Validate schema
      if (manifest.schema !== "commonground-license-registry/v1") {
        throw new Error(`Unknown registry schema: ${manifest.schema}`);
      }

      // Entries are now inline in the manifest
      if (!manifest.entries || manifest.entries.length === 0) {
        throw new Error("Registry has no entries");
      }

      // Entries are sorted newest first
      const currentEntry = manifest.entries[0];
      
      setEntryChain(manifest.entries);
      setState({ status: "loaded", manifest, currentEntry });
    } catch (error) {
      console.error("Failed to fetch registry:", error);
      
      if (error instanceof TypeError && error.message.includes("fetch")) {
        setState({ status: "not_found", ensName: ensName ?? "unknown" });
      } else {
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Failed to fetch registry",
        });
      }
    }
  }, [ensName, contentRefOverride]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  return {
    state,
    entryChain,
    refresh: fetchRegistry,
    ensName,
    contentRef,
  };
}

/**
 * Hook to verify a license entry.
 * 
 * @param entry - The entry to verify
 * @param contentRef - The content reference for fetching files
 */
export function useEntryVerification(
  entry: LicenseEntry | null,
  contentRef: ContentReference | null
): {
  verifying: boolean;
  result: ChainVerificationResult | null;
  verify: () => Promise<void>;
} {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<ChainVerificationResult | null>(null);

  const verify = useCallback(async () => {
    if (!entry || !contentRef) return;

    setVerifying(true);
    const checks: VerificationCheck[] = [];
    const entries: LicenseEntry[] = [];

    try {
      entries.push(entry);

      // Check 1: Required fields present
      checks.push({
        id: "structure",
        description: "Entry structure is valid",
        passed: !!(entry.version && entry.effective_date && entry.license),
        error: !(entry.version && entry.effective_date && entry.license) 
          ? "Missing required fields" 
          : undefined,
      });

      // Check 2: License text hash
      try {
        let licenseText: string;
        
        if (contentRef.protocol === "ens") {
          licenseText = await fetchTextFromEnsGateway(contentRef.hash, entry.license.text_path);
        } else {
          const ipfs = getIpfsGateway();
          licenseText = await ipfs.fetchTextFromDir(contentRef.hash, entry.license.text_path);
        }
        
        const hashValid = await verifyHash(licenseText, entry.license.text_sha256);
        checks.push({
          id: "license_hash",
          description: "License text hash matches",
          passed: hashValid,
          error: !hashValid ? "License text hash mismatch" : undefined,
        });
      } catch (error) {
        checks.push({
          id: "license_hash",
          description: "License text hash matches",
          passed: false,
          error: `Failed to fetch license text: ${error}`,
        });
      }

      setResult({
        valid: checks.every(c => c.passed),
        entryCount: entries.length,
        checks,
        entries,
      });
    } catch (error) {
      checks.push({
        id: "fetch",
        description: "Registry data fetchable",
        passed: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      setResult({
        valid: false,
        entryCount: 0,
        checks,
        entries: [],
      });
    } finally {
      setVerifying(false);
    }
  }, [entry, contentRef]);

  return { verifying, result, verify };
}
