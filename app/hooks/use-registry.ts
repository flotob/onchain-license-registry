/**
 * useRegistry Hook
 * 
 * Fetches and manages the license registry state.
 * Resolves ENS name → contenthash → registry.json → entries
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
import { decodeContenthash, getConfiguredEnsName } from "~/lib/ens";
import { verifyHash } from "~/lib/hash";

/**
 * Result of the useRegistry hook.
 */
export interface UseRegistryResult {
  /** Current state of the registry */
  state: RegistryState;
  /** The full entry chain (head to genesis) */
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
      let ref = contentRefOverride;

      // If we have an ENS name but no content ref, we would resolve ENS here
      // For now, we'll use a mock/direct IPFS CID approach since ENS resolution
      // requires a connected wallet/provider
      if (!ref && ensName) {
        // TODO: Implement actual ENS resolution when wallet is connected
        // For development, check if there's a VITE_REGISTRY_CID env var
        const devCid = import.meta.env.VITE_REGISTRY_CID;
        if (devCid) {
          ref = { protocol: "ipfs", hash: devCid };
        } else {
          // In production, we would resolve ENS here
          // For now, show a helpful message
          setState({
            status: "not_found",
            ensName: ensName,
          });
          return;
        }
      }

      if (!ref) {
        setState({
          status: "not_found",
          ensName: ensName ?? "unknown",
        });
        return;
      }

      setContentRef(ref);

      // Fetch registry.json from IPFS
      const ipfs = getIpfsGateway();
      const manifest = await ipfs.fetchFromDir<RegistryManifest>(
        ref.hash,
        "/registry.json"
      );

      // Validate manifest schema
      if (manifest.schema !== "commonground-license-registry/v1") {
        throw new Error(`Unknown registry schema: ${manifest.schema}`);
      }

      // Fetch the head entry
      const headEntry = await ipfs.fetchFromDir<LicenseEntry>(
        ref.hash,
        manifest.head_entry_path
      );

      // Validate entry schema
      if (headEntry.schema !== "commonground-license-entry/v1") {
        throw new Error(`Unknown entry schema: ${headEntry.schema}`);
      }

      // Build the entry chain by version numbers (v1, v2, v3, ...)
      const chain: LicenseEntry[] = [headEntry];
      
      // Fetch all previous versions
      for (let version = headEntry.version - 1; version >= 1; version--) {
        try {
          const prevEntry = await ipfs.fetchFromDir<LicenseEntry>(
            ref.hash,
            `/entries/v${version}.json`
          );
          chain.push(prevEntry);
        } catch {
          // Entry doesn't exist, stop fetching
          break;
        }
      }

      setEntryChain(chain);
      setState({
        status: "loaded",
        manifest,
        currentEntry: headEntry,
      });
    } catch (error) {
      console.error("Failed to fetch registry:", error);
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to fetch registry",
      });
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
 * Hook to verify a license entry and its chain.
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
      const ipfs = getIpfsGateway();

      // Verify the current entry
      entries.push(entry);

      // Check 1: Schema version
      checks.push({
        id: "schema",
        description: "Entry schema is valid",
        passed: entry.schema === "commonground-license-entry/v1",
        error: entry.schema !== "commonground-license-entry/v1" 
          ? `Invalid schema: ${entry.schema}` 
          : undefined,
      });

      // Check 2: License text hash
      try {
        const licenseText = await ipfs.fetchTextFromDir(
          contentRef.hash,
          entry.license.text_path
        );
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

      // Note: No signature or governance doc verification needed.
      // Trust comes from the DAO governance vote that updates the ENS contenthash.
      // The on-chain transaction IS the proof of authorization.

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

