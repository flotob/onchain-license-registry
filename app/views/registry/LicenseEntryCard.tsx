/**
 * LicenseEntryCard Component
 * 
 * Displays a license entry with its details.
 */

import type { LicenseEntry, ContentReference } from "~/types/license-registry";
import { COMMON_SPDX_LICENSES } from "~/types/license-registry";
import { getContentUrl } from "~/lib/storage";

interface LicenseEntryCardProps {
  entry: LicenseEntry;
  contentRef: ContentReference | null;
  isHead?: boolean;
  onViewLicense?: () => void;
  onViewGovernance?: () => void;
}

/**
 * Get human-readable license name from SPDX ID.
 */
function getLicenseName(spdx: string): string {
  const license = COMMON_SPDX_LICENSES.find(l => l.id === spdx);
  return license?.name ?? spdx;
}

/**
 * Format a date string for display.
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * Truncate a hash for display.
 */
function truncateHash(hash: string, length = 8): string {
  if (hash.length <= length * 2) return hash;
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
}

export function LicenseEntryCard({
  entry,
  contentRef,
  isHead = false,
  onViewLicense,
  onViewGovernance,
}: LicenseEntryCardProps) {
  const licenseName = getLicenseName(entry.license.spdx);
  const effectiveDate = formatDate(entry.effective_date);
  const createdAt = formatDate(entry.created_at);

  // Build gateway URLs for viewing files
  const licenseUrl = contentRef
    ? `${getContentUrl(contentRef)}${entry.license.text_path.startsWith("/") ? "" : "/"}${entry.license.text_path}`
    : null;
  
  const governanceUrl = entry.governance && contentRef
    ? `${getContentUrl(contentRef)}${entry.governance.decision_path.startsWith("/") ? "" : "/"}${entry.governance.decision_path}`
    : null;

  return (
    <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-text-primary">
            Version {entry.version}
          </span>
          {isHead && (
            <span className="px-2 py-0.5 text-xs font-medium bg-accent/10 text-accent rounded-full">
              Current
            </span>
          )}
        </div>
        <span className="text-sm text-text-muted">
          {createdAt}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* License Info */}
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-medium text-text-secondary">License</h4>
              <p className="text-text-primary font-medium">{licenseName}</p>
              <p className="text-sm text-text-muted font-mono">{entry.license.spdx}</p>
            </div>
            {licenseUrl && (
              <a
                href={licenseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:text-accent-hover transition-colors"
              >
                View License →
              </a>
            )}
          </div>
          
          <div className="text-xs text-text-muted font-mono bg-bg-elevated rounded px-2 py-1">
            SHA-256: {truncateHash(entry.license.text_sha256, 12)}
          </div>
        </div>

        {/* Effective Date */}
        <div>
          <h4 className="text-sm font-medium text-text-secondary">Effective Date</h4>
          <p className="text-text-primary">{effectiveDate}</p>
        </div>

        {/* Governance (if present) */}
        {entry.governance && (
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-medium text-text-secondary">Governance Decision</h4>
                <p className="text-sm text-text-muted">{entry.governance.decision_path}</p>
              </div>
              {governanceUrl && (
                <a
                  href={governanceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent hover:text-accent-hover transition-colors"
                >
                  View Document →
                </a>
              )}
            </div>
            <div className="text-xs text-text-muted font-mono bg-bg-elevated rounded px-2 py-1">
              SHA-256: {truncateHash(entry.governance.decision_sha256, 12)}
            </div>
          </div>
        )}

        {/* Signatures */}
        <div>
          <h4 className="text-sm font-medium text-text-secondary mb-2">
            Signatures ({entry.signatures.length})
          </h4>
          <div className="space-y-1">
            {entry.signatures.map((sig, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-sm bg-bg-elevated rounded px-2 py-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="font-mono text-text-secondary truncate">
                  {sig.signer}
                </span>
              </div>
            ))}
            {entry.signatures.length === 0 && (
              <p className="text-sm text-text-muted italic">No signatures</p>
            )}
          </div>
        </div>

        {/* Previous Entry Reference */}
        {entry.prev_entry_ref && (
          <div className="pt-2 border-t border-border">
            <h4 className="text-sm font-medium text-text-secondary">Previous Version</h4>
            <p className="text-xs text-text-muted font-mono">
              {entry.prev_entry_ref.protocol}://{truncateHash(entry.prev_entry_ref.hash, 16)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact version of the entry card for history view.
 */
export function LicenseEntryRow({
  entry,
  onClick,
}: {
  entry: LicenseEntry;
  onClick?: () => void;
}) {
  const licenseName = getLicenseName(entry.license.spdx);
  const effectiveDate = formatDate(entry.effective_date);

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 bg-bg-surface border border-border rounded-lg hover:bg-bg-elevated transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-text-primary">
            v{entry.version}
          </span>
          <span className="text-sm text-text-secondary">
            {licenseName}
          </span>
        </div>
        <span className="text-sm text-text-muted">
          {effectiveDate}
        </span>
      </div>
    </button>
  );
}

