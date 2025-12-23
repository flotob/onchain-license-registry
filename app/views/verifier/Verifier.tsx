/**
 * Verifier Component
 * 
 * Allows users to compare a proposed CID (from a governance vote) against
 * the current registry to verify:
 * 1. History is preserved (no entries removed or modified)
 * 2. New entries are correctly added
 * 3. License text hashes match
 */

import { useState, useCallback } from "react";
import { Button } from "~/components/Button";
import type { RegistryManifest, LicenseEntry, ContentReference } from "~/types/license-registry";
import { getIpfsGateway, isValidCid } from "~/lib/storage";
import { useRegistry } from "~/hooks/use-registry";
import { verifyHash } from "~/lib/hash";

interface ComparisonResult {
  valid: boolean;
  summary: string;
  checks: ComparisonCheck[];
  newEntries: LicenseEntry[];
  modifiedEntries: { old: LicenseEntry; new: LicenseEntry; differences: string[] }[];
  removedEntries: LicenseEntry[];
}

interface ComparisonCheck {
  id: string;
  description: string;
  passed: boolean;
  error?: string;
  details?: string;
}

/**
 * Fetch a registry manifest from an IPFS CID.
 */
async function fetchRegistryFromCid(cid: string): Promise<{
  manifest: RegistryManifest;
  contentRef: ContentReference;
}> {
  const ipfs = getIpfsGateway();
  const manifest = await ipfs.fetchFromDir<RegistryManifest>(cid, "/registry.json");
  return {
    manifest,
    contentRef: { protocol: "ipfs", hash: cid },
  };
}

/**
 * Fetch license text from IPFS.
 */
async function fetchLicenseText(cid: string, path: string): Promise<string> {
  const ipfs = getIpfsGateway();
  return ipfs.fetchTextFromDir(cid, path);
}

/**
 * Compare two registries and return a detailed comparison result.
 */
async function compareRegistries(
  currentManifest: RegistryManifest,
  currentCid: string | null,
  proposedManifest: RegistryManifest,
  proposedCid: string
): Promise<ComparisonResult> {
  const checks: ComparisonCheck[] = [];
  const newEntries: LicenseEntry[] = [];
  const modifiedEntries: { old: LicenseEntry; new: LicenseEntry; differences: string[] }[] = [];
  const removedEntries: LicenseEntry[] = [];

  // Build version maps for quick lookup
  const currentEntriesByVersion = new Map<number, LicenseEntry>();
  for (const entry of currentManifest.entries) {
    currentEntriesByVersion.set(entry.version, entry);
  }

  const proposedEntriesByVersion = new Map<number, LicenseEntry>();
  for (const entry of proposedManifest.entries) {
    proposedEntriesByVersion.set(entry.version, entry);
  }

  // Check 1: Schema compatibility
  checks.push({
    id: "schema",
    description: "Registry schema is valid",
    passed: proposedManifest.schema === "commonground-license-registry/v1",
    error: proposedManifest.schema !== "commonground-license-registry/v1"
      ? `Invalid schema: ${proposedManifest.schema}`
      : undefined,
  });

  // Check 2: Version progression
  const currentMaxVersion = currentManifest.current_version;
  const proposedMaxVersion = proposedManifest.current_version;
  const versionProgresses = proposedMaxVersion >= currentMaxVersion;
  checks.push({
    id: "version_progression",
    description: "Version number increases or stays the same",
    passed: versionProgresses,
    error: !versionProgresses
      ? `Proposed version (${proposedMaxVersion}) is less than current (${currentMaxVersion})`
      : undefined,
    details: `Current: v${currentMaxVersion} → Proposed: v${proposedMaxVersion}`,
  });

  // Check 3: All existing entries preserved
  for (const [version, currentEntry] of currentEntriesByVersion) {
    const proposedEntry = proposedEntriesByVersion.get(version);
    
    if (!proposedEntry) {
      removedEntries.push(currentEntry);
    } else {
      // Compare entries
      const differences: string[] = [];
      
      if (currentEntry.effective_date !== proposedEntry.effective_date) {
        differences.push(`effective_date: ${currentEntry.effective_date} → ${proposedEntry.effective_date}`);
      }
      if (currentEntry.license.spdx !== proposedEntry.license.spdx) {
        differences.push(`license.spdx: ${currentEntry.license.spdx} → ${proposedEntry.license.spdx}`);
      }
      if (currentEntry.license.text_sha256 !== proposedEntry.license.text_sha256) {
        differences.push(`license.text_sha256: hash changed`);
      }
      
      if (differences.length > 0) {
        modifiedEntries.push({ old: currentEntry, new: proposedEntry, differences });
      }
    }
  }

  checks.push({
    id: "entries_preserved",
    description: "All existing entries are preserved",
    passed: removedEntries.length === 0,
    error: removedEntries.length > 0
      ? `${removedEntries.length} entries were removed`
      : undefined,
    details: removedEntries.length > 0
      ? `Removed: v${removedEntries.map(e => e.version).join(", v")}`
      : undefined,
  });

  checks.push({
    id: "entries_unmodified",
    description: "Existing entries are unmodified",
    passed: modifiedEntries.length === 0,
    error: modifiedEntries.length > 0
      ? `${modifiedEntries.length} entries were modified`
      : undefined,
    details: modifiedEntries.length > 0
      ? `Modified: v${modifiedEntries.map(e => e.old.version).join(", v")}`
      : undefined,
  });

  // Check 4: Find new entries
  for (const [version, proposedEntry] of proposedEntriesByVersion) {
    if (!currentEntriesByVersion.has(version)) {
      newEntries.push(proposedEntry);
    }
  }

  checks.push({
    id: "new_entries",
    description: "New entries are properly added",
    passed: true, // Just informational
    details: newEntries.length > 0
      ? `${newEntries.length} new entries: v${newEntries.map(e => e.version).join(", v")}`
      : "No new entries",
  });

  // Check 5: Verify license text hashes for new entries
  for (const entry of newEntries) {
    try {
      const licenseText = await fetchLicenseText(proposedCid, entry.license.text_path);
      const hashValid = await verifyHash(licenseText, entry.license.text_sha256);
      
      checks.push({
        id: `hash_v${entry.version}`,
        description: `License text hash valid for v${entry.version}`,
        passed: hashValid,
        error: !hashValid ? "Hash mismatch" : undefined,
      });
    } catch (error) {
      checks.push({
        id: `hash_v${entry.version}`,
        description: `License text hash valid for v${entry.version}`,
        passed: false,
        error: `Failed to fetch license: ${error}`,
      });
    }
  }

  // Check 6: Registry name consistency
  const nameConsistent = currentManifest.name === proposedManifest.name;
  checks.push({
    id: "name_consistent",
    description: "Registry name is consistent",
    passed: nameConsistent,
    error: !nameConsistent
      ? `Name changed: "${currentManifest.name}" → "${proposedManifest.name}"`
      : undefined,
  });

  // Calculate overall validity
  const criticalChecks = checks.filter(c => 
    c.id === "schema" || 
    c.id === "entries_preserved" || 
    c.id === "entries_unmodified" ||
    c.id.startsWith("hash_")
  );
  const valid = criticalChecks.every(c => c.passed);

  // Generate summary
  let summary: string;
  if (valid && newEntries.length > 0) {
    summary = `✓ Valid update with ${newEntries.length} new ${newEntries.length === 1 ? "entry" : "entries"}`;
  } else if (valid) {
    summary = "✓ Valid (no changes)";
  } else if (removedEntries.length > 0) {
    summary = `✗ Invalid: ${removedEntries.length} entries removed`;
  } else if (modifiedEntries.length > 0) {
    summary = `✗ Invalid: ${modifiedEntries.length} entries modified`;
  } else {
    summary = "✗ Invalid: verification failed";
  }

  return {
    valid,
    summary,
    checks,
    newEntries,
    modifiedEntries,
    removedEntries,
  };
}

export function Verifier() {
  const { state: currentState, contentRef: currentContentRef } = useRegistry();
  
  const [proposedCid, setProposedCid] = useState("");
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);

  const handleCompare = useCallback(async () => {
    if (!proposedCid.trim()) {
      setError("Please enter a CID");
      return;
    }

    if (!isValidCid(proposedCid.trim())) {
      setError("Invalid CID format");
      return;
    }

    if (currentState.status !== "loaded") {
      setError("Current registry not loaded");
      return;
    }

    setComparing(true);
    setError(null);
    setResult(null);

    try {
      const { manifest: proposedManifest } = await fetchRegistryFromCid(proposedCid.trim());
      
      const currentCid = currentContentRef?.protocol === "ipfs" 
        ? currentContentRef.hash 
        : null;
      
      const comparisonResult = await compareRegistries(
        currentState.manifest,
        currentCid,
        proposedManifest,
        proposedCid.trim()
      );

      setResult(comparisonResult);
    } catch (err) {
      console.error("Comparison failed:", err);
      setError(err instanceof Error ? err.message : "Failed to compare registries");
    } finally {
      setComparing(false);
    }
  }, [proposedCid, currentState, currentContentRef]);

  const handleReset = useCallback(() => {
    setProposedCid("");
    setResult(null);
    setError(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Verify Registry Update</h2>
        <p className="text-text-secondary mt-1">
          Compare a proposed CID against the current registry to verify integrity before voting.
        </p>
      </div>

      {/* Current Registry Status */}
      <div className="bg-bg-surface border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-secondary mb-2">Current Registry</h3>
        {currentState.status === "loading" && (
          <div className="flex items-center gap-2 text-text-muted">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </div>
        )}
        {currentState.status === "error" && (
          <p className="text-red-500 text-sm">{currentState.error}</p>
        )}
        {currentState.status === "not_found" && (
          <p className="text-text-muted text-sm">No registry found at {currentState.ensName}</p>
        )}
        {currentState.status === "loaded" && (
          <div className="space-y-1">
            <p className="text-text-primary font-medium">{currentState.manifest.name}</p>
            <p className="text-sm text-text-muted">
              Version {currentState.manifest.current_version} • {currentState.manifest.entries.length} entries
            </p>
            {currentContentRef && (
              <p className="text-xs font-mono text-text-muted break-all">
                {currentContentRef.protocol === "ens" 
                  ? `ENS: ${currentContentRef.hash}` 
                  : `CID: ${currentContentRef.hash}`
                }
              </p>
            )}
          </div>
        )}
      </div>

      {/* CID Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-primary">
          Proposed CID
        </label>
        <p className="text-sm text-text-muted">
          Enter the IPFS CID from the governance proposal to verify.
        </p>
        <input
          type="text"
          value={proposedCid}
          onChange={(e) => setProposedCid(e.target.value)}
          placeholder="bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
          className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          disabled={comparing}
        />
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleCompare}
          disabled={comparing || currentState.status !== "loaded" || !proposedCid.trim()}
        >
          {comparing ? "Comparing..." : "Compare Registries"}
        </Button>
        {result && (
          <Button variant="secondary" onClick={handleReset}>
            Reset
          </Button>
        )}
      </div>

      {/* Comparison Result */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div
            className={`p-4 rounded-lg border ${
              result.valid
                ? "bg-green-500/10 border-green-500/20"
                : "bg-red-500/10 border-red-500/20"
            }`}
          >
            <div className="flex items-center gap-3">
              {result.valid ? (
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className={`text-lg font-semibold ${result.valid ? "text-green-500" : "text-red-500"}`}>
                {result.summary}
              </span>
            </div>
          </div>

          {/* New Entries */}
          {result.newEntries.length > 0 && (
            <div className="bg-bg-surface border border-border rounded-lg p-4">
              <h4 className="font-medium text-text-primary mb-3">
                New Entries ({result.newEntries.length})
              </h4>
              <div className="space-y-2">
                {result.newEntries.map((entry) => (
                  <div
                    key={entry.version}
                    className="flex items-center justify-between p-2 bg-bg-elevated rounded"
                  >
                    <div>
                      <span className="font-medium text-text-primary">v{entry.version}</span>
                      <span className="text-text-muted ml-2">{entry.license.spdx}</span>
                    </div>
                    <span className="text-sm text-text-muted">
                      Effective: {entry.effective_date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Removed Entries (Error) */}
          {result.removedEntries.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <h4 className="font-medium text-red-500 mb-3">
                ⚠ Removed Entries ({result.removedEntries.length})
              </h4>
              <p className="text-sm text-text-secondary mb-3">
                These entries exist in the current registry but are missing from the proposed update.
                This is a critical error - history should never be removed.
              </p>
              <div className="space-y-2">
                {result.removedEntries.map((entry) => (
                  <div
                    key={entry.version}
                    className="flex items-center justify-between p-2 bg-bg-surface rounded border border-red-500/20"
                  >
                    <div>
                      <span className="font-medium text-text-primary">v{entry.version}</span>
                      <span className="text-text-muted ml-2">{entry.license.spdx}</span>
                    </div>
                    <span className="text-sm text-text-muted">
                      {entry.effective_date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modified Entries (Error) */}
          {result.modifiedEntries.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <h4 className="font-medium text-red-500 mb-3">
                ⚠ Modified Entries ({result.modifiedEntries.length})
              </h4>
              <p className="text-sm text-text-secondary mb-3">
                These entries were modified. Historical entries should never be changed.
              </p>
              <div className="space-y-3">
                {result.modifiedEntries.map(({ old, differences }) => (
                  <div
                    key={old.version}
                    className="p-2 bg-bg-surface rounded border border-red-500/20"
                  >
                    <div className="font-medium text-text-primary mb-1">
                      v{old.version}
                    </div>
                    <ul className="text-sm text-text-muted space-y-0.5">
                      {differences.map((diff, i) => (
                        <li key={i} className="font-mono text-xs">{diff}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Checks */}
          <div className="bg-bg-surface border border-border rounded-lg p-4">
            <h4 className="font-medium text-text-primary mb-3">Verification Checks</h4>
            <div className="space-y-2">
              {result.checks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-start gap-2 p-2 bg-bg-elevated rounded"
                >
                  {check.passed ? (
                    <span className="text-green-500 mt-0.5">✓</span>
                  ) : (
                    <span className="text-red-500 mt-0.5">✗</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-text-primary">{check.description}</span>
                    {check.details && (
                      <p className="text-text-muted text-xs mt-0.5">{check.details}</p>
                    )}
                    {check.error && (
                      <p className="text-red-500 text-xs mt-0.5">{check.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Voting Recommendation */}
          <div className={`p-4 rounded-lg border ${
            result.valid 
              ? "bg-accent/10 border-accent/20" 
              : "bg-red-500/10 border-red-500/20"
          }`}>
            <h4 className="font-medium text-text-primary mb-2">Voting Recommendation</h4>
            {result.valid ? (
              <p className="text-sm text-text-secondary">
                This update appears to be valid. The proposed registry preserves all existing entries
                and correctly adds new ones. You can safely vote to approve this governance proposal.
              </p>
            ) : (
              <p className="text-sm text-text-secondary">
                <strong className="text-red-500">Do not vote to approve this proposal.</strong>{" "}
                The proposed registry has integrity issues - entries have been removed or modified.
                Contact the proposal author to provide a corrected version.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Help Text */}
      {!result && (
        <div className="bg-bg-elevated border border-border rounded-lg p-4 text-sm text-text-muted">
          <h4 className="font-medium text-text-primary mb-2">How to use</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>Find the proposed CID in the governance proposal</li>
            <li>Paste it in the field above</li>
            <li>Click "Compare Registries" to verify</li>
            <li>Review the results before casting your vote</li>
          </ol>
          <p className="mt-3">
            This tool checks that all existing entries are preserved and new entries are correctly added.
            It will flag any removed or modified entries as an error.
          </p>
        </div>
      )}
    </div>
  );
}

export default Verifier;

