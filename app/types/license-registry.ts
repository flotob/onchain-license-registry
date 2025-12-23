/**
 * License Registry Types
 * 
 * Storage-agnostic type definitions for the append-only license registry.
 * Supports IPFS, Swarm, Arweave, and other decentralized storage protocols.
 */

// ============================================
// Storage Protocol Types
// ============================================

/**
 * Supported decentralized storage protocols.
 * Maps to ENS contenthash codec types (EIP-1577 / ENSIP-7).
 * 
 * "ens" is a special value indicating content is accessed via ENS gateway
 * (e.g., .limo) where the raw CID is not known but the ENS name is.
 */
export type StorageProtocol = "ipfs" | "ipns" | "bzz" | "ar" | "ens";

/**
 * Storage-agnostic content reference.
 * Can represent an IPFS CID, Swarm hash, Arweave TX ID, or ENS name.
 */
export interface ContentReference {
  /** The storage protocol (or "ens" for ENS gateway access) */
  protocol: StorageProtocol;
  /** The content hash/identifier (CID for IPFS, 32-byte hash for Swarm, ENS name for "ens") */
  hash: string;
}

// ============================================
// License Entry Types
// ============================================

/**
 * License information within an entry.
 */
export interface LicenseInfo {
  /** SPDX license identifier (e.g., "MIT", "AGPL-3.0-only") */
  spdx: string;
  /** Relative path to license text file within registry */
  text_path: string;
  /** SHA-256 hash of the license text file for verification */
  text_sha256: string;
}

/**
 * A single entry in the license registry.
 * Forms a hash-chain for tamper-evidence (each entry links to the previous).
 * 
 * Trust model: Authorization comes from the DAO governance vote that updates
 * the ENS contenthash. The on-chain transaction IS the proof of authorization.
 */
export interface LicenseEntry {
  /** Schema identifier for versioning */
  schema: "commonground-license-entry/v1";
  /** Version number (1, 2, 3, ...) */
  version: number;
  /** ISO timestamp when entry was created */
  created_at: string;
  /** ISO date when the license becomes effective */
  effective_date: string;
  /** License information */
  license: LicenseInfo;
}

// ============================================
// Registry Manifest Types
// ============================================

/**
 * The registry manifest (registry.json).
 * Points to the current head entry and provides metadata.
 * 
 * Trust model: The ENS contenthash points to the IPFS directory CID.
 * Use head_entry_path relative to that CID to fetch the current entry.
 */
export interface RegistryManifest {
  /** Schema identifier for versioning */
  schema: "commonground-license-registry/v1";
  /** Human-readable name of the registry */
  name: string;
  /** Optional description */
  description?: string;
  /** Current version number (matches head entry version) */
  current_version: number;
  /** Relative path to head entry file (e.g., "/entries/v1.json") */
  head_entry_path: string;
}

// ============================================
// Verification Types
// ============================================

/**
 * Result of verifying a single check.
 */
export interface VerificationCheck {
  /** Check identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** Whether the check passed */
  passed: boolean;
  /** Optional error message if failed */
  error?: string;
  /** Optional additional details */
  details?: string;
}

/**
 * Result of verifying the entire chain.
 */
export interface ChainVerificationResult {
  /** Whether all checks passed */
  valid: boolean;
  /** Total number of entries verified */
  entryCount: number;
  /** Individual check results */
  checks: VerificationCheck[];
  /** Entries in order from head to genesis */
  entries: LicenseEntry[];
}

// ============================================
// Common SPDX Licenses
// ============================================

/**
 * Common SPDX license identifiers for the UI selector.
 */
export const COMMON_SPDX_LICENSES = [
  { id: "MIT", name: "MIT License" },
  { id: "Apache-2.0", name: "Apache License 2.0" },
  { id: "GPL-3.0-only", name: "GNU General Public License v3.0 only" },
  { id: "GPL-3.0-or-later", name: "GNU General Public License v3.0 or later" },
  { id: "AGPL-3.0-only", name: "GNU Affero General Public License v3.0 only" },
  { id: "AGPL-3.0-or-later", name: "GNU Affero General Public License v3.0 or later" },
  { id: "LGPL-3.0-only", name: "GNU Lesser General Public License v3.0 only" },
  { id: "BSD-2-Clause", name: "BSD 2-Clause \"Simplified\" License" },
  { id: "BSD-3-Clause", name: "BSD 3-Clause \"New\" or \"Revised\" License" },
  { id: "MPL-2.0", name: "Mozilla Public License 2.0" },
  { id: "ISC", name: "ISC License" },
  { id: "Unlicense", name: "The Unlicense" },
  { id: "CC0-1.0", name: "Creative Commons Zero v1.0 Universal" },
  { id: "CC-BY-4.0", name: "Creative Commons Attribution 4.0 International" },
  { id: "CC-BY-SA-4.0", name: "Creative Commons Attribution-ShareAlike 4.0 International" },
] as const;

export type CommonSpdxLicense = typeof COMMON_SPDX_LICENSES[number]["id"];

// ============================================
// Utility Types
// ============================================

/**
 * Registry state for the UI.
 */
export type RegistryState = 
  | { status: "loading" }
  | { status: "not_found"; ensName: string }
  | { status: "error"; error: string }
  | { status: "loaded"; manifest: RegistryManifest; currentEntry: LicenseEntry };

/**
 * Entry creation form data.
 */
export interface CreateEntryFormData {
  spdx: string;
  licenseText: string;
  licenseFileName: string;
  effectiveDate: string;
}

