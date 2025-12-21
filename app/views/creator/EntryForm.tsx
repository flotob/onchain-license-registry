/**
 * EntryForm Component
 * 
 * Form for creating new license registry entries.
 * No wallet connection required - trust comes from DAO governance.
 */

import { useState, useCallback, useRef } from "react";
import { Button } from "~/components/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/Select";
import type { LicenseEntry, LicenseInfo } from "~/types/license-registry";
import { COMMON_SPDX_LICENSES } from "~/types/license-registry";
import { sha256, hashFileWithContent } from "~/lib/hash";
import { getLicenseFilePath } from "~/lib/publisher";

interface EntryFormProps {
  /** Current version number (new entry will be version + 1, or 1 if genesis) */
  currentVersion: number;
  /** Callback when entry is successfully created */
  onEntryCreated: (entry: LicenseEntry, licenseText: string) => void;
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
}

export function EntryForm({
  currentVersion,
  onEntryCreated,
  defaultLicense,
}: EntryFormProps) {
  const licenseInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState<FormState>({
    spdxId: defaultLicense ?? "",
    customSpdx: "",
    effectiveDate: new Date().toISOString().split("T")[0],
    licenseText: "",
  });
  
  // Track uploaded filename for display only
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

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
      }));
      setUploadedFileName(file.name);
      setErrors(prev => ({ ...prev, licenseText: "" }));
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        licenseText: "Failed to read file",
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [actualSpdxId, form]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setCreating(true);

    try {
      // Calculate hash
      const licenseHash = await sha256(form.licenseText);
      const newVersion = currentVersion + 1;

      // Create license info with versioned path
      const licenseInfo: LicenseInfo = {
        spdx: actualSpdxId,
        text_path: getLicenseFilePath(newVersion),
        text_sha256: licenseHash,
      };

      // Create entry
      const entry: LicenseEntry = {
        schema: "commonground-license-entry/v1",
        version: newVersion,
        created_at: new Date().toISOString(),
        effective_date: form.effectiveDate,
        license: licenseInfo,
      };

      // Call the callback
      onEntryCreated(entry, form.licenseText);
    } catch (error) {
      console.error("Failed to create entry:", error);
      setErrors(prev => ({
        ...prev,
        submit: error instanceof Error ? error.message : "Failed to create entry",
      }));
    } finally {
      setCreating(false);
    }
  }, [validate, form, actualSpdxId, currentVersion, onEntryCreated]);

  const newVersion = currentVersion + 1;
  const isGenesisEntry = currentVersion === 0;

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
          {uploadedFileName && form.licenseText && (
            <span className="flex items-center text-sm text-text-secondary">
              {uploadedFileName}
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
