/**
 * RegistryViewer Component
 * 
 * Main component for viewing the license registry.
 * Handles loading, error, and success states.
 */

import { useState } from "react";
import type { LicenseEntry, ContentReference, RegistryManifest } from "~/types/license-registry";
import { useRegistry, useEntryVerification } from "~/hooks/use-registry";
import { LicenseEntryCard, LicenseEntryRow } from "./LicenseEntryCard";
import { Button } from "~/components/Button";

interface RegistryViewerProps {
  ensName?: string;
  contentRef?: ContentReference;
}

/**
 * Loading skeleton for the registry viewer.
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-bg-elevated rounded w-1/3" />
      <div className="h-4 bg-bg-elevated rounded w-2/3" />
      <div className="bg-bg-surface border border-border rounded-lg p-4 space-y-3">
        <div className="h-6 bg-bg-elevated rounded w-1/4" />
        <div className="h-4 bg-bg-elevated rounded w-1/2" />
        <div className="h-4 bg-bg-elevated rounded w-3/4" />
        <div className="h-4 bg-bg-elevated rounded w-1/3" />
      </div>
    </div>
  );
}

/**
 * Error state display.
 */
function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
      <svg
        className="w-12 h-12 mx-auto text-red-500 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        Failed to Load Registry
      </h3>
      <p className="text-text-secondary mb-4">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary">
          Try Again
        </Button>
      )}
    </div>
  );
}

/**
 * Not found state display.
 */
function NotFoundState({ ensName }: { ensName: string }) {
  return (
    <div className="bg-bg-elevated border border-border rounded-lg p-6 text-center">
      <svg
        className="w-12 h-12 mx-auto text-text-muted mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        No Registry Found
      </h3>
      <p className="text-text-secondary">
        No license registry is published at <code className="font-mono text-accent">{ensName}</code>.
      </p>
      <p className="text-sm text-text-muted mt-2">
        The registry will appear here once it's published to IPFS and linked via ENS.
      </p>
    </div>
  );
}

/**
 * Verification panel component.
 */
function VerificationPanel({
  entry,
  contentRef,
}: {
  entry: LicenseEntry;
  contentRef: ContentReference | null;
}) {
  const { verifying, result, verify } = useEntryVerification(entry, contentRef);

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Verification</h3>
        <Button
          onClick={verify}
          disabled={verifying}
          variant="secondary"
          size="sm"
        >
          {verifying ? "Verifying..." : "Verify Entry"}
        </Button>
      </div>

      {result && (
        <div className="space-y-2">
          <div
            className={`flex items-center gap-2 p-2 rounded ${
              result.valid
                ? "bg-green-500/10 text-green-500"
                : "bg-red-500/10 text-red-500"
            }`}
          >
            {result.valid ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-medium">
              {result.valid ? "All checks passed" : "Some checks failed"}
            </span>
          </div>

          <div className="space-y-1">
            {result.checks.map((check) => (
              <div
                key={check.id}
                className="flex items-start gap-2 text-sm p-2 bg-bg-elevated rounded"
              >
                {check.passed ? (
                  <span className="text-green-500 mt-0.5">✓</span>
                ) : (
                  <span className="text-red-500 mt-0.5">✗</span>
                )}
                <div className="flex-1">
                  <span className="text-text-primary">{check.description}</span>
                  {check.error && (
                    <p className="text-text-muted text-xs mt-0.5">{check.error}</p>
                  )}
                  {check.details && (
                    <p className="text-text-muted text-xs mt-0.5">{check.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!result && (
        <p className="text-sm text-text-muted">
          Click "Verify Entry" to check the integrity of this license entry.
        </p>
      )}
    </div>
  );
}

/**
 * Main registry viewer component.
 */
export function RegistryViewer({ ensName, contentRef }: RegistryViewerProps) {
  const { state, entryChain, refresh, contentRef: resolvedContentRef } = useRegistry(
    ensName,
    contentRef
  );
  const [showHistory, setShowHistory] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LicenseEntry | null>(null);

  // Loading state
  if (state.status === "loading") {
    return <LoadingSkeleton />;
  }

  // Error state
  if (state.status === "error") {
    return <ErrorState message={state.error} onRetry={refresh} />;
  }

  // Not found state
  if (state.status === "not_found") {
    return <NotFoundState ensName={state.ensName} />;
  }

  // Loaded state
  const { manifest, currentEntry } = state;
  const displayEntry = selectedEntry ?? currentEntry;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{manifest.name}</h2>
        {manifest.description && (
          <p className="text-text-secondary mt-1">{manifest.description}</p>
        )}
        <div className="flex items-center gap-4 mt-2 text-sm text-text-muted">
          <span>Version {manifest.current_version}</span>
          <span>•</span>
          <span className="font-mono">
            {manifest.head_entry_ref.protocol}://{manifest.head_entry_ref.hash.slice(0, 16)}...
          </span>
        </div>
      </div>

      {/* Current Entry */}
      <LicenseEntryCard
        entry={displayEntry}
        contentRef={resolvedContentRef}
        isHead={displayEntry.version === currentEntry.version}
      />

      {/* Verification */}
      <VerificationPanel entry={displayEntry} contentRef={resolvedContentRef} />

      {/* History */}
      {entryChain.length > 1 && (
        <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-bg-elevated transition-colors"
          >
            <span className="font-semibold text-text-primary">
              Version History ({entryChain.length} entries)
            </span>
            <svg
              className={`w-5 h-5 text-text-muted transition-transform ${
                showHistory ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showHistory && (
            <div className="p-4 pt-0 space-y-2">
              {entryChain.map((entry) => (
                <LicenseEntryRow
                  key={entry.version}
                  entry={entry}
                  onClick={() => setSelectedEntry(entry)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={refresh} variant="secondary">
          Refresh
        </Button>
        {selectedEntry && selectedEntry.version !== currentEntry.version && (
          <Button onClick={() => setSelectedEntry(null)} variant="ghost">
            Back to Current
          </Button>
        )}
      </div>
    </div>
  );
}

export default RegistryViewer;

