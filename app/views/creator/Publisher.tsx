/**
 * Publisher Component
 * 
 * Displays the created entry and generates a ZIP download.
 */

import { useState, useCallback } from "react";
import { Button } from "~/components/Button";
import type { LicenseEntry } from "~/types/license-registry";
import { COMMON_SPDX_LICENSES } from "~/types/license-registry";
import { createRegistryPackage, downloadBlob, generatePackageFilename } from "~/lib/publisher";
import { LicenseEntryCard } from "~/views/registry/LicenseEntryCard";

interface PublisherProps {
  /** The signed entry to publish */
  entry: LicenseEntry;
  /** License text content */
  licenseText: string;
  /** License file name */
  licenseFileName: string;
  /** Optional governance document */
  governanceDoc?: ArrayBuffer;
  /** Optional governance file name */
  governanceFileName?: string;
  /** Registry name */
  registryName: string;
  /** Optional registry description */
  registryDescription?: string;
  /** Callback to go back to form */
  onBack: () => void;
  /** Callback when published successfully */
  onPublished?: () => void;
}

/**
 * Get license name from SPDX ID.
 */
function getLicenseName(spdx: string): string {
  const license = COMMON_SPDX_LICENSES.find(l => l.id === spdx);
  return license?.name ?? spdx;
}

export function Publisher({
  entry,
  licenseText,
  licenseFileName,
  governanceDoc,
  governanceFileName,
  registryName,
  registryDescription,
  onBack,
  onPublished,
}: PublisherProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setError(null);

    try {
      const zipBlob = await createRegistryPackage({
        name: registryName,
        description: registryDescription,
        newEntry: entry,
        licenseText,
        licenseFileName,
        governanceDoc,
        governanceFileName,
      });

      const filename = generatePackageFilename(registryName, entry.version);
      downloadBlob(zipBlob, filename);
      setDownloaded(true);
      onPublished?.();
    } catch (err) {
      console.error("Failed to create package:", err);
      setError(err instanceof Error ? err.message : "Failed to create package");
    } finally {
      setDownloading(false);
    }
  }, [entry, licenseText, licenseFileName, governanceDoc, governanceFileName, registryName, registryDescription, onPublished]);

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              Entry Created Successfully!
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              Your license entry has been signed. Download the registry package and upload it to IPFS.
            </p>
          </div>
        </div>
      </div>

      {/* Entry Preview */}
      <div>
        <h4 className="text-sm font-medium text-text-secondary mb-2">Entry Preview</h4>
        <LicenseEntryCard entry={entry} contentRef={null} isHead />
      </div>

      {/* Entry JSON */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-text-secondary">Entry JSON</h4>
        <pre className="bg-bg-elevated border border-border rounded-lg p-4 text-xs font-mono text-text-secondary overflow-x-auto">
          {JSON.stringify(entry, null, 2)}
        </pre>
      </div>

      {/* Download Section */}
      <div className="bg-bg-surface border border-border rounded-lg p-4 space-y-4">
        <div>
          <h4 className="text-lg font-semibold text-text-primary">Download & Publish</h4>
          <p className="text-sm text-text-secondary mt-1">
            Download the registry package as a ZIP file, then upload it to IPFS.
          </p>
        </div>

        <div className="bg-bg-elevated rounded-lg p-4 text-sm text-text-secondary space-y-2">
          <p className="font-medium text-text-primary">Publishing steps:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Download the registry package (ZIP)</li>
            <li>Extract and upload the folder to IPFS (e.g., via web3.storage, Pinata)</li>
            <li>Copy the resulting CID</li>
            <li>Update the ENS contenthash record to point to ipfs://CID</li>
          </ol>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1"
          >
            {downloading ? (
              "Creating package..."
            ) : downloaded ? (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Again
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Registry Package
              </>
            )}
          </Button>
          <Button variant="secondary" onClick={onBack}>
            Create Another
          </Button>
        </div>

        {downloaded && (
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 text-sm text-accent">
            Package downloaded! Now upload the extracted folder to IPFS.
          </div>
        )}
      </div>

      {/* IPFS Upload Options */}
      <div className="bg-bg-surface border border-border rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium text-text-primary">IPFS Upload Services</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href="https://web3.storage"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-bg-elevated rounded-lg hover:bg-bg-muted transition-colors text-sm text-text-secondary"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            web3.storage
          </a>
          <a
            href="https://pinata.cloud"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-bg-elevated rounded-lg hover:bg-bg-muted transition-colors text-sm text-text-secondary"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Pinata
          </a>
          <a
            href="https://nft.storage"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-bg-elevated rounded-lg hover:bg-bg-muted transition-colors text-sm text-text-secondary"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            nft.storage
          </a>
        </div>
      </div>
    </div>
  );
}

export default Publisher;

