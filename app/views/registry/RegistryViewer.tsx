/**
 * RegistryViewer Component
 * 
 * Main component for viewing the license registry.
 * Displays all license entries in a flat list.
 */

import type { ContentReference } from "~/types/license-registry";
import { useRegistry } from "~/hooks/use-registry";
import { LicenseEntryCard } from "./LicenseEntryCard";
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
 * Main registry viewer component.
 * Shows all license entries in a flat list (newest first).
 */
export function RegistryViewer({ ensName, contentRef }: RegistryViewerProps) {
  const { state, entryChain, refresh, contentRef: resolvedContentRef } = useRegistry(
    ensName,
    contentRef
  );

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{manifest.name}</h2>
        {manifest.description && (
          <p className="text-text-secondary mt-1">{manifest.description}</p>
        )}
        <div className="flex items-center gap-4 mt-2 text-sm text-text-muted">
          <span>{entryChain.length} {entryChain.length === 1 ? 'version' : 'versions'}</span>
          <span>•</span>
          <span>Current: v{manifest.current_version}</span>
        </div>
      </div>

      {/* All Entries - flat list, newest first */}
      <div className="space-y-4">
        {entryChain.map((entry) => (
          <LicenseEntryCard
            key={entry.version}
            entry={entry}
            contentRef={resolvedContentRef}
            isHead={entry.version === currentEntry.version}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={refresh} variant="secondary">
          Refresh
        </Button>
      </div>
    </div>
  );
}

export default RegistryViewer;
