/**
 * Creator View
 * 
 * Main page for creating new license registry entries.
 * No wallet connection required - trust comes from DAO governance.
 */

import { useState, useEffect, useCallback } from "react";
import type { LicenseEntry, ContentReference } from "~/types/license-registry";
import { useRegistry } from "~/hooks/use-registry";
import { getIpfsGateway } from "~/lib/storage";
import { EntryForm } from "./EntryForm";
import { Publisher } from "./Publisher";

/**
 * State for the creator flow.
 */
type CreatorState =
  | { step: "form" }
  | { 
      step: "publish"; 
      entry: LicenseEntry;
      licenseText: string;
    };

/**
 * Registry name input component.
 */
function RegistryNameInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-text-primary">
        Registry Name <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., Common Ground License Registry"
        className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}

/**
 * Fetch license text for an entry from IPFS or ENS gateway.
 */
async function fetchLicenseText(
  entry: LicenseEntry, 
  contentRef: ContentReference | null
): Promise<string | null> {
  if (!contentRef) return null;
  
  try {
    if (contentRef.protocol === "ens") {
      // Fetch via ENS gateway
      const url = `https://${contentRef.hash}.limo${entry.license.text_path}`;
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) return null;
      return response.text();
    } else {
      // Fetch via IPFS gateway
      const ipfs = getIpfsGateway();
      return await ipfs.fetchTextFromDir(contentRef.hash, entry.license.text_path);
    }
  } catch (error) {
    console.error(`Failed to fetch license for v${entry.version}:`, error);
    return null;
  }
}

export function Creator() {
  const { state: registryState, entryChain, contentRef } = useRegistry();
  
  const [creatorState, setCreatorState] = useState<CreatorState>({ step: "form" });
  const [registryName, setRegistryName] = useState("Common Ground License Registry");
  const [registryDescription, setRegistryDescription] = useState("");
  
  // Previous entries and their license texts (fetched from existing registry)
  const [previousLicenses, setPreviousLicenses] = useState<Map<number, string>>(new Map());
  const [fetchingLicenses, setFetchingLicenses] = useState(false);

  // Determine current version
  const currentVersion = registryState.status === "loaded" 
    ? registryState.manifest.current_version 
    : 0;

  // Fetch license texts for all entries when registry is loaded
  useEffect(() => {
    async function fetchAllLicenses() {
      if (registryState.status !== "loaded" || !contentRef || entryChain.length === 0) {
        return;
      }
      
      setFetchingLicenses(true);
      const licenses = new Map<number, string>();
      
      for (const entry of entryChain) {
        const text = await fetchLicenseText(entry, contentRef);
        if (text) {
          licenses.set(entry.version, text);
        }
      }
      
      setPreviousLicenses(licenses);
      setFetchingLicenses(false);
    }
    
    fetchAllLicenses();
  }, [registryState.status, contentRef, entryChain]);

  // Handle entry creation
  const handleEntryCreated = (entry: LicenseEntry, licenseText: string) => {
    setCreatorState({
      step: "publish",
      entry,
      licenseText,
    });
  };

  // Handle back to form
  const handleBack = () => {
    setCreatorState({ step: "form" });
  };

  // Loading existing registry
  if (registryState.status === "loading") {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-text-primary">Create License Entry</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-bg-elevated rounded w-1/3" />
          <div className="h-4 bg-bg-elevated rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Create License Entry</h2>
        <p className="text-text-secondary mt-1">
          {registryState.status === "loaded"
            ? `Create a new version of the ${registryState.manifest.name} registry.`
            : "Create a new license registry from scratch."
          }
        </p>
      </div>

      {/* Existing Registry Info */}
      {registryState.status === "loaded" && (
        <div className="bg-bg-elevated border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-secondary">Building on:</span>
            <span className="font-medium text-text-primary">
              {registryState.manifest.name} v{registryState.manifest.current_version}
            </span>
            <span className="text-text-muted">•</span>
            <span className="text-text-muted font-mono">
              {registryState.currentEntry.license.spdx}
            </span>
          </div>
          
          {/* Previous entries status */}
          <div className="text-xs text-text-muted">
            {fetchingLicenses ? (
              <span className="flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Fetching previous entries...
              </span>
            ) : previousLicenses.size > 0 ? (
              <span className="text-green-600">
                ✓ {previousLicenses.size} previous {previousLicenses.size === 1 ? 'entry' : 'entries'} will be included in package
              </span>
            ) : entryChain.length > 0 ? (
              <span className="text-yellow-600">
                ⚠ Could not fetch previous license texts (CORS issue)
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* Genesis Registry Info */}
      {(registryState.status === "not_found" || registryState.status === "error") && creatorState.step === "form" && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-accent flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm text-text-primary font-medium">
                Creating a new registry (Genesis Entry)
              </p>
              <p className="text-sm text-text-secondary mt-1">
                No existing registry found. This will create the first entry in a new registry.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {creatorState.step === "form" && (
        <div className="space-y-6">
          {/* Registry Name (for genesis) */}
          {registryState.status !== "loaded" && (
            <div className="bg-bg-surface border border-border rounded-lg p-4 space-y-4">
              <RegistryNameInput
                value={registryName}
                onChange={setRegistryName}
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-primary">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={registryDescription}
                  onChange={(e) => setRegistryDescription(e.target.value)}
                  placeholder="e.g., Official license registry for Common Ground DAO"
                  className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
          )}

          {/* Entry Form */}
          <EntryForm
            currentVersion={currentVersion}
            onEntryCreated={handleEntryCreated}
            defaultLicense={
              registryState.status === "loaded"
                ? registryState.currentEntry.license.spdx
                : undefined
            }
          />
        </div>
      )}

      {/* Publisher */}
      {creatorState.step === "publish" && (
        <Publisher
          entry={creatorState.entry}
          licenseText={creatorState.licenseText}
          registryName={
            registryState.status === "loaded"
              ? registryState.manifest.name
              : registryName
          }
          registryDescription={
            registryState.status === "loaded"
              ? registryState.manifest.description
              : registryDescription || undefined
          }
          previousEntries={entryChain}
          previousLicenses={previousLicenses}
          onBack={handleBack}
        />
      )}
    </div>
  );
}

export default Creator;
