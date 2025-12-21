/**
 * Publisher Utilities
 * 
 * Creates ZIP packages for publishing license registries to IPFS.
 */

import JSZip from "jszip";
import type { LicenseEntry, RegistryManifest, ContentReference } from "~/types/license-registry";
import { sha256 } from "./hash";

/**
 * Data needed to create a registry package.
 */
export interface RegistryPackageData {
  /** Registry name */
  name: string;
  /** Optional description */
  description?: string;
  /** The new entry to add */
  newEntry: LicenseEntry;
  /** License text content */
  licenseText: string;
  /** License file name (e.g., "LICENSE.md") */
  licenseFileName: string;
  /** Optional governance document content */
  governanceDoc?: ArrayBuffer;
  /** Optional governance file name */
  governanceFileName?: string;
  /** Previous entries (for including history) */
  previousEntries?: LicenseEntry[];
}

/**
 * Create a complete registry ZIP package.
 * 
 * Structure:
 * /registry.json         - Manifest pointing to head entry
 * /licenses/LICENSE.md   - License text files
 * /governance/...        - Governance documents
 * /entries/v1.json       - Entry JSON files
 * /entries/v2.json
 * ...
 */
export async function createRegistryPackage(data: RegistryPackageData): Promise<Blob> {
  const zip = new JSZip();
  
  // Create folders
  const licensesFolder = zip.folder("licenses");
  const entriesFolder = zip.folder("entries");
  const governanceFolder = zip.folder("governance");

  if (!licensesFolder || !entriesFolder || !governanceFolder) {
    throw new Error("Failed to create ZIP folders");
  }

  // Add license text
  licensesFolder.file(data.licenseFileName, data.licenseText);

  // Add governance doc if present
  if (data.governanceDoc && data.governanceFileName) {
    governanceFolder.file(data.governanceFileName, data.governanceDoc);
  }

  // Add the new entry
  const entryFileName = `v${data.newEntry.version}.json`;
  entriesFolder.file(entryFileName, JSON.stringify(data.newEntry, null, 2));

  // Add previous entries if provided
  if (data.previousEntries) {
    for (const entry of data.previousEntries) {
      const prevFileName = `v${entry.version}.json`;
      entriesFolder.file(prevFileName, JSON.stringify(entry, null, 2));
    }
  }

  // Create manifest
  // Note: The actual CID will be determined after upload
  // For now, we use a placeholder that will be updated by the IPFS upload process
  const manifest: RegistryManifest = {
    schema: "commonground-license-registry/v1",
    name: data.name,
    description: data.description,
    current_version: data.newEntry.version,
    head_entry_path: `/entries/${entryFileName}`,
    head_entry_ref: {
      protocol: "ipfs",
      hash: "PLACEHOLDER_CID_WILL_BE_SET_AFTER_UPLOAD",
    },
  };

  zip.file("registry.json", JSON.stringify(manifest, null, 2));

  // Add a README for human readers
  const readme = `# License Registry

This package contains the license registry for ${data.name}.

## Structure

- \`registry.json\` - Registry manifest
- \`entries/\` - License entry JSON files
- \`licenses/\` - License text files
- \`governance/\` - Governance decision documents

## Current Version

Version ${data.newEntry.version} - ${data.newEntry.license.spdx}
Effective: ${data.newEntry.effective_date}

## Verification

Each entry contains SHA-256 hashes of the license text and governance documents.
Signatures can be verified using EIP-712 typed data verification.

## Publishing

To publish this registry:
1. Upload this entire folder to IPFS (e.g., via web3.storage, Pinata, or ipfs add -r)
2. Note the resulting CID
3. Update the ENS contenthash record to point to the CID
`;

  zip.file("README.md", readme);

  // Generate the ZIP
  return zip.generateAsync({ type: "blob" });
}

/**
 * Download a blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a filename for the registry package.
 */
export function generatePackageFilename(name: string, version: number): string {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const timestamp = new Date().toISOString().split("T")[0];
  return `${safeName}-registry-v${version}-${timestamp}.zip`;
}

/**
 * Validate that all required files are present in the entry.
 */
export function validateEntryFiles(entry: LicenseEntry, files: {
  licenseText?: string;
  governanceDoc?: ArrayBuffer;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!files.licenseText) {
    errors.push("License text is required");
  }

  if (entry.governance && !files.governanceDoc) {
    errors.push("Governance document is required when governance info is set");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

