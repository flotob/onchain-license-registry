/**
 * EIP-712 Typed Data Signing for License Entries
 * 
 * Implements structured data signing for license registry entries.
 * Uses wagmi/viem for wallet interaction.
 */

import type { LicenseEntry, LicenseInfo, GovernanceInfo, ContentReference } from "~/types/license-registry";

/**
 * EIP-712 domain for license entries.
 */
export const LICENSE_ENTRY_DOMAIN = {
  name: "CommonGround License Registry",
  version: "1",
  // No chainId - signatures are chain-agnostic for IPFS content
} as const;

/**
 * EIP-712 types for license entry signing.
 */
export const LICENSE_ENTRY_TYPES = {
  LicenseEntry: [
    { name: "schema", type: "string" },
    { name: "version", type: "uint256" },
    { name: "created_at", type: "string" },
    { name: "effective_date", type: "string" },
    { name: "license_spdx", type: "string" },
    { name: "license_text_sha256", type: "bytes32" },
    { name: "prev_entry_hash", type: "string" },
  ],
} as const;

/**
 * Prepare an entry for EIP-712 signing.
 * Converts the entry to the typed data format.
 */
export function prepareEntryForSigning(entry: Omit<LicenseEntry, "signatures">): {
  domain: typeof LICENSE_ENTRY_DOMAIN;
  types: typeof LICENSE_ENTRY_TYPES;
  primaryType: "LicenseEntry";
  message: Record<string, unknown>;
} {
  // Convert prev_entry_ref to a string representation
  const prevEntryHash = entry.prev_entry_ref
    ? `${entry.prev_entry_ref.protocol}://${entry.prev_entry_ref.hash}`
    : "";

  // Ensure the hash is properly formatted as bytes32 (with 0x prefix)
  const licenseHashBytes32 = entry.license.text_sha256.startsWith("0x")
    ? entry.license.text_sha256
    : `0x${entry.license.text_sha256}`;

  return {
    domain: LICENSE_ENTRY_DOMAIN,
    types: LICENSE_ENTRY_TYPES,
    primaryType: "LicenseEntry",
    message: {
      schema: entry.schema,
      version: BigInt(entry.version),
      created_at: entry.created_at,
      effective_date: entry.effective_date,
      license_spdx: entry.license.spdx,
      license_text_sha256: licenseHashBytes32,
      prev_entry_hash: prevEntryHash,
    },
  };
}

/**
 * Create an unsigned entry from form data.
 */
export function createUnsignedEntry(params: {
  version: number;
  effectiveDate: string;
  license: LicenseInfo;
  governance?: GovernanceInfo;
  prevEntryRef: ContentReference | null;
}): Omit<LicenseEntry, "signatures"> {
  return {
    schema: "commonground-license-entry/v1",
    version: params.version,
    created_at: new Date().toISOString(),
    effective_date: params.effectiveDate,
    license: params.license,
    governance: params.governance,
    prev_entry_ref: params.prevEntryRef,
  };
}

/**
 * Verify an EIP-712 signature on an entry.
 * Returns the recovered signer address.
 */
export async function verifyEntrySignature(
  entry: Omit<LicenseEntry, "signatures">,
  signature: string
): Promise<string> {
  const { verifyTypedData } = await import("viem");
  const typedData = prepareEntryForSigning(entry);
  
  const recoveredAddress = await verifyTypedData({
    ...typedData,
    signature: signature as `0x${string}`,
  });
  
  return recoveredAddress;
}

/**
 * Format a signature for storage in the entry.
 */
export function formatSignature(signer: string, signature: string): {
  type: "eip712";
  signer: string;
  sig: string;
} {
  return {
    type: "eip712",
    signer: signer.toLowerCase(),
    sig: signature,
  };
}

