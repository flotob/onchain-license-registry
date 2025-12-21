/**
 * EntryForm Component
 * 
 * Form for creating new license registry entries.
 * No wallet connection required - trust comes from DAO governance.
 */

import { useState, useCallback, useRef } from "react";
import { Button } from "~/components/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/Select";
import type { LicenseEntry, LicenseInfo, GovernanceInfo, ContentReference } from "~/types/license-registry";
import { COMMON_SPDX_LICENSES } from "~/types/license-registry";
import { sha256, hashFileWithContent, hashBinaryFile } from "~/lib/hash";

interface EntryFormProps {
  /** Previous entry reference (null for genesis entry) */
  prevEntryRef: ContentReference | null;
  /** Current version number (new entry will be version + 1) */
  currentVersion: number;
  /** Callback when entry is successfully created */
  onEntryCreated: (entry: LicenseEntry, files: {
    licenseText: string;
    licenseFileName: string;
    governanceDoc?: ArrayBuffer;
    governanceFileName?: string;
  }) => void;
  /** Optional: prefill with existing license */
  defaultLicense?: string;
}

/**
 * Form state type.
 */
interface FormState {
  spdxId: string;
  customSpdx: string;
  effectiveDate: string;
  licenseText: string;
  licenseFileName: string;
  governanceDoc: ArrayBuffer | null;
  governanceFileName: string;
  includeGovernance: boolean;
}

export function EntryForm({
  prevEntryRef,
  currentVersion,
  onEntryCreated,
  defaultLicense,
}: EntryFormProps) {
  const licenseInputRef = useRef<HTMLInputElement>(null);
  const governanceInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState<FormState>({
    spdxId: defaultLicense ?? "",
    customSpdx: "",
    effectiveDate: new Date().toISOString().split("T")[0],
    licenseText: "",
    licenseFileName: "LICENSE.md",
    governanceDoc: null,
    governanceFileName: "",
    includeGovernance: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  // Get the actual SPDX ID (custom or selected)
  const actualSpdxId = form.spdxId === "custom" ? form.customSpdx : form.spdxId;

  // Handle license file upload
  const handleLicenseFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await hashFileWithContent(file);
      setForm(prev => ({
        ...prev,
        licenseText: result.content,
        licenseFileName: file.name,
      }));
      setErrors(prev => ({ ...prev, licenseText: "" }));
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        licenseText: "Failed to read file",
      }));
    }
  }, []);

  // Handle governance file upload
  const handleGovernanceFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await hashBinaryFile(file);
      setForm(prev => ({
        ...prev,
        governanceDoc: result.content,
        governanceFileName: file.name,
      }));
      setErrors(prev => ({ ...prev, governanceDoc: "" }));
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        governanceDoc: "Failed to read file",
      }));
    }
  }, []);

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!actualSpdxId) {
      newErrors.spdxId = "Please select a license";
    }

    if (!form.effectiveDate) {
      newErrors.effectiveDate = "Effective date is required";
    }

    if (!form.licenseText.trim()) {
      newErrors.licenseText = "License text is required";
    }

    if (form.includeGovernance && !form.governanceDoc) {
      newErrors.governanceDoc = "Governance document is required when enabled";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [actualSpdxId, form]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setCreating(true);

    try {
      // Calculate hashes
      const licenseHash = await sha256(form.licenseText);
      
      let governanceInfo: GovernanceInfo | undefined;
      if (form.includeGovernance && form.governanceDoc) {
        const govHash = await sha256(new TextDecoder().decode(form.governanceDoc));
        governanceInfo = {
          decision_path: `/governance/${form.governanceFileName}`,
          decision_sha256: govHash,
        };
      }

      // Create license info
      const licenseInfo: LicenseInfo = {
        spdx: actualSpdxId,
        text_path: `/licenses/${form.licenseFileName}`,
        text_sha256: licenseHash,
      };

      // Create entry
      const entry: LicenseEntry = {
        schema: "commonground-license-entry/v1",
        version: currentVersion + 1,
        created_at: new Date().toISOString(),
        effective_date: form.effectiveDate,
        license: licenseInfo,
        governance: governanceInfo,
        prev_entry_ref: prevEntryRef,
      };

      // Call the callback
      onEntryCreated(entry, {
        licenseText: form.licenseText,
        licenseFileName: form.licenseFileName,
        governanceDoc: form.governanceDoc ?? undefined,
        governanceFileName: form.governanceFileName || undefined,
      });
    } catch (error) {
      console.error("Failed to create entry:", error);
      setErrors(prev => ({
        ...prev,
        submit: error instanceof Error ? error.message : "Failed to create entry",
      }));
    } finally {
      setCreating(false);
    }
  }, [validate, form, actualSpdxId, currentVersion, prevEntryRef, onEntryCreated]);

  const newVersion = currentVersion + 1;
  const isGenesisEntry = prevEntryRef === null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="bg-bg-surface border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-text-primary">
          {isGenesisEntry ? "Create Genesis Entry" : `Create Version ${newVersion}`}
        </h3>
        <p className="text-sm text-text-muted mt-1">
          {isGenesisEntry 
            ? "This will be the first entry in the registry"
            : `Building on version ${currentVersion}`
          }
        </p>
      </div>

      {/* License Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-primary">
          License <span className="text-red-500">*</span>
        </label>
        <Select
          value={form.spdxId}
          onValueChange={(value) => setForm(prev => ({ ...prev, spdxId: value }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a license..." />
          </SelectTrigger>
          <SelectContent>
            {COMMON_SPDX_LICENSES.map((license) => (
              <SelectItem key={license.id} value={license.id}>
                {license.name} ({license.id})
              </SelectItem>
            ))}
            <SelectItem value="custom">Custom SPDX ID...</SelectItem>
          </SelectContent>
        </Select>
        
        {form.spdxId === "custom" && (
          <input
            type="text"
            value={form.customSpdx}
            onChange={(e) => setForm(prev => ({ ...prev, customSpdx: e.target.value }))}
            placeholder="Enter SPDX identifier (e.g., BSD-4-Clause)"
            className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        )}
        
        {errors.spdxId && (
          <p className="text-sm text-red-500">{errors.spdxId}</p>
        )}
      </div>

      {/* Effective Date */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-primary">
          Effective Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={form.effectiveDate}
          onChange={(e) => setForm(prev => ({ ...prev, effectiveDate: e.target.value }))}
          className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {errors.effectiveDate && (
          <p className="text-sm text-red-500">{errors.effectiveDate}</p>
        )}
      </div>

      {/* License Text */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-primary">
          License Text <span className="text-red-500">*</span>
        </label>
        
        <div className="flex gap-2">
          <input
            ref={licenseInputRef}
            type="file"
            accept=".txt,.md,.markdown"
            onChange={handleLicenseFileUpload}
            className="hidden"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => licenseInputRef.current?.click()}
          >
            Upload File
          </Button>
          {form.licenseFileName && form.licenseText && (
            <span className="flex items-center text-sm text-text-secondary">
              {form.licenseFileName}
            </span>
          )}
        </div>

        <textarea
          value={form.licenseText}
          onChange={(e) => setForm(prev => ({ ...prev, licenseText: e.target.value }))}
          placeholder="Paste license text here or upload a file..."
          rows={8}
          className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
        />
        
        {errors.licenseText && (
          <p className="text-sm text-red-500">{errors.licenseText}</p>
        )}
      </div>

      {/* Governance Document (Optional) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="includeGovernance"
            checked={form.includeGovernance}
            onChange={(e) => setForm(prev => ({ ...prev, includeGovernance: e.target.checked }))}
            className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
          />
          <label htmlFor="includeGovernance" className="text-sm font-medium text-text-primary">
            Include governance decision document
          </label>
        </div>

        {form.includeGovernance && (
          <div className="pl-6 space-y-2">
            <input
              ref={governanceInputRef}
              type="file"
              accept=".pdf,.txt,.md,.markdown"
              onChange={handleGovernanceFileUpload}
              className="hidden"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => governanceInputRef.current?.click()}
              >
                Upload Governance Doc
              </Button>
              {form.governanceFileName && (
                <span className="flex items-center text-sm text-text-secondary">
                  {form.governanceFileName}
                </span>
              )}
            </div>
            {errors.governanceDoc && (
              <p className="text-sm text-red-500">{errors.governanceDoc}</p>
            )}
          </div>
        )}
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-sm text-red-500">{errors.submit}</p>
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        disabled={creating}
        className="w-full"
      >
        {creating ? "Creating..." : "Create Entry"}
      </Button>
    </form>
  );
}

export default EntryForm;
