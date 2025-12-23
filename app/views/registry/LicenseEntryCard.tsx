/**
 * LicenseEntryCard Component
 * 
 * Displays a license entry with its details.
 */

import type { LicenseEntry, ContentReference } from "~/types/license-registry";
import { COMMON_SPDX_LICENSES } from "~/types/license-registry";
import { getContentUrl } from "~/lib/storage";
import { useCgPluginLib } from "~/context/plugin_lib";

interface LicenseEntryCardProps {
  entry: LicenseEntry;
  contentRef: ContentReference | null;
  isHead?: boolean;
  onViewLicense?: () => void;
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
}: LicenseEntryCardProps) {
  const cgPluginLib = useCgPluginLib();
  const licenseName = getLicenseName(entry.license.spdx);
  const effectiveDate = formatDate(entry.effective_date);

  // Build gateway URL for viewing license
  const licenseUrl = contentRef
    ? `${getContentUrl(contentRef)}${entry.license.text_path.startsWith("/") ? "" : "/"}${entry.license.text_path}`
    : null;

  // Handle external link navigation (required for iframe sandbox)
  const handleViewLicense = async () => {
    if (!licenseUrl) return;
    if (cgPluginLib) {
      await cgPluginLib.navigate(licenseUrl);
    } else {
      // Fallback for development outside iframe
      window.open(licenseUrl, "_blank");
    }
  };

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
          Effective: {effectiveDate}
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
              <button
                onClick={handleViewLicense}
                className="text-sm text-accent hover:text-accent-hover transition-colors"
              >
                View License →
              </button>
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

        {/* Previous Version */}
        {entry.version > 1 && (
          <div className="pt-2 border-t border-border">
            <p className="text-sm text-text-muted">
              Supersedes version {entry.version - 1}
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

