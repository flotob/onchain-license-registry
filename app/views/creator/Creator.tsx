/**
 * Creator View
 * 
 * Main page for creating new license registry entries.
 */

import { useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { Button } from "~/components/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "~/components/Dialog";
import type { LicenseEntry, ContentReference } from "~/types/license-registry";
import { useRegistry } from "~/hooks/use-registry";
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
      files: {
        licenseText: string;
        licenseFileName: string;
        governanceDoc?: ArrayBuffer;
        governanceFileName?: string;
      };
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
 * Connect wallet prompt.
 */
function ConnectWalletPrompt() {
  const { connect, connectors } = useConnect();
  const installedWallets = connectors.filter(c => c.type === "injected");

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-8 text-center">
      <svg
        className="w-16 h-16 mx-auto text-text-muted mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      <h3 className="text-xl font-semibold text-text-primary mb-2">
        Connect Your Wallet
      </h3>
      <p className="text-text-secondary mb-6">
        You need to connect a wallet to sign license entries.
      </p>
      <Dialog>
        <DialogTrigger asChild>
          <Button>Connect Wallet</Button>
        </DialogTrigger>
        <DialogContent className="w-fit">
          <DialogHeader>
            <DialogTitle>Choose a wallet to connect</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <div className="flex flex-col gap-2 w-full pt-4">
              {installedWallets.map(c => (
                <Button key={c.id} variant="primary" className="w-full" onClick={() => connect({ connector: c })}>
                  {c.name}
                </Button>
              ))}
              <DialogClose asChild>
                <Button variant="secondary" className="w-full">Close</Button>
              </DialogClose>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function Creator() {
  const { isConnected } = useAccount();
  const { state: registryState, entryChain, contentRef } = useRegistry();
  
  const [creatorState, setCreatorState] = useState<CreatorState>({ step: "form" });
  const [registryName, setRegistryName] = useState("Common Ground License Registry");
  const [registryDescription, setRegistryDescription] = useState("");

  // Determine current version and prev entry ref
  const currentVersion = registryState.status === "loaded" 
    ? registryState.manifest.current_version 
    : 0;
  
  const prevEntryRef: ContentReference | null = registryState.status === "loaded"
    ? registryState.manifest.head_entry_ref
    : null;

  // Handle entry creation
  const handleEntryCreated = (entry: LicenseEntry, files: {
    licenseText: string;
    licenseFileName: string;
    governanceDoc?: ArrayBuffer;
    governanceFileName?: string;
  }) => {
    setCreatorState({
      step: "publish",
      entry,
      files,
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
        <div className="bg-bg-elevated border border-border rounded-lg p-4">
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

      {/* Wallet Connection Check */}
      {!isConnected && creatorState.step === "form" && (
        <ConnectWalletPrompt />
      )}

      {/* Main Content */}
      {isConnected && creatorState.step === "form" && (
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
            prevEntryRef={prevEntryRef}
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
          licenseText={creatorState.files.licenseText}
          licenseFileName={creatorState.files.licenseFileName}
          governanceDoc={creatorState.files.governanceDoc}
          governanceFileName={creatorState.files.governanceFileName}
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
          onBack={handleBack}
        />
      )}
    </div>
  );
}

export default Creator;

