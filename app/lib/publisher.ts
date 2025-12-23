/**
 * Publisher Utilities
 * 
 * Creates ZIP packages for publishing license registries to IPFS.
 */

import JSZip from "jszip";
import type { LicenseEntry, RegistryManifest } from "~/types/license-registry";

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
  /** License text content for the new entry */
  licenseText: string;
  /** Previous entries (for including history) */
  previousEntries?: LicenseEntry[];
  /** Previous license texts (keyed by version number) */
  previousLicenses?: Map<number, string>;
}

/**
 * Generate the license file path for a given version.
 * Uses versioned naming to avoid conflicts: /licenses/v1.md, /licenses/v2.md, etc.
 */
export function getLicenseFilePath(version: number): string {
  return `/licenses/v${version}.md`;
}

/**
 * Create a complete registry ZIP package.
 * 
 * Structure:
 * /registry.json       - Manifest with all entries inline
 * /licenses/v1.md      - License text for version 1
 * /licenses/v2.md      - License text for version 2
 * ...
 */
export async function createRegistryPackage(data: RegistryPackageData): Promise<Blob> {
  const zip = new JSZip();
  
  // Create licenses folder
  const licensesFolder = zip.folder("licenses");

  if (!licensesFolder) {
    throw new Error("Failed to create ZIP folders");
  }

  // Add the new entry's license with versioned filename
  const licenseFileName = `v${data.newEntry.version}.md`;
  licensesFolder.file(licenseFileName, data.licenseText);

  // Build entries array (newest first)
  const allEntries: LicenseEntry[] = [data.newEntry];

  // Add previous entries and their licenses if provided
  if (data.previousEntries) {
    for (const entry of data.previousEntries) {
      // Add to entries array
      allEntries.push(entry);
      
      // Add previous license if available
      if (data.previousLicenses?.has(entry.version)) {
        const prevLicenseFileName = `v${entry.version}.md`;
        licensesFolder.file(prevLicenseFileName, data.previousLicenses.get(entry.version)!);
      }
    }
  }

  // Sort entries by version (newest first)
  allEntries.sort((a, b) => b.version - a.version);

  // Create manifest with all entries inline
  const manifest: RegistryManifest = {
    schema: "commonground-license-registry/v1",
    name: data.name,
    description: data.description,
    current_version: data.newEntry.version,
    entries: allEntries,
  };

  zip.file("registry.json", JSON.stringify(manifest, null, 2));

  // Add a README for human readers
  const readme = `# License Registry

This package contains the license registry for ${data.name}.

## Structure

- \`registry.json\` - Registry manifest with all entries inline
- \`licenses/\` - License text files (v1.md, v2.md, ...)

## Current Version

Version ${data.newEntry.version} - ${data.newEntry.license.spdx}
Effective: ${data.newEntry.effective_date}

## All Versions

${allEntries.map(e => `- v${e.version}: ${e.license.spdx} (effective ${e.effective_date})`).join('\n')}

## Verification

Each entry contains SHA-256 hashes of the license text for integrity verification.
Trust is established through the DAO governance vote that updates the ENS contenthash.

## Publishing

To publish this registry:
1. Upload this entire folder to IPFS (e.g., via web3.storage, Pinata, or ipfs add -r)
2. Note the resulting CID
3. Propose a DAO governance vote to update the ENS contenthash
4. Once approved and executed, the registry becomes official

## Fetching

To verify/fetch this registry:
1. Resolve ENS name → get IPFS directory CID
2. Fetch \`/registry.json\` from that CID
3. All entries are inline in the manifest
4. Verify license text SHA-256 hashes match the files in /licenses/
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
 * Validate that all required files are present.
 */
export function validateEntryFiles(files: {
  licenseText?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!files.licenseText) {
    errors.push("License text is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
