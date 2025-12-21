import type { TokenData } from "~/hooks/token-data";
import { MdContentCopy } from "react-icons/md";
import { useGetChainNameById } from "~/hooks/contracts";

interface TokenMetadataDisplayProps {
  tokenData?: TokenData;
  tokenAddress?: `0x${string}`;
  chainId?: number;
  small?: boolean;
}

export default function TokenMetadataDisplay({ tokenData, chainId, tokenAddress, small }: TokenMetadataDisplayProps) {
  const getChainNameById = useGetChainNameById();

  if (!tokenData) {
    return <div className="p-4 text-text-muted w-full max-w-full text-center">No contract data provided</div>;
  }

  if (!tokenData.isFetching && !tokenData.type) {
    return null;
  }

  if (tokenData.isFetching) {
    return (
      <div className="bg-bg-elevated shadow-lg rounded-lg w-full max-w-full mb-4">
        <div className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-bg-muted rounded w-1/2"></div>
          </div>
          <div className="text-sm text-text-muted mt-2">Loading token metadata...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-elevated shadow-lg rounded-lg w-full max-w-full mb-4">
      <div className="p-4">
        <div className="flex flex-col">
          <div className="text-lg font-bold text-text-primary flex items-center gap-2">
            {tokenData.type === "erc20" ? tokenData.erc20Data?.name : tokenData.lsp7Data?.lsp4TokenName}
            <span className="text-xs px-2 py-0.5 rounded bg-accent text-text-inverted">
              {tokenData.type === "lsp7" ? 'LSP7' : 'ERC20'}
            </span>
            {chainId !== undefined && (
              <span className="text-xs px-2 py-0.5 rounded bg-accent text-text-inverted">
                {getChainNameById(chainId)}
              </span>
            )}
          </div>
          <div className="text-xs text-text-muted flex flex-row items-center font-mono">
            {tokenAddress?.substring(0, 6)}...{tokenAddress?.substring(tokenAddress.length - 4)}
            <button className="p-1 ml-1 hover:bg-bg-muted rounded transition-colors" onClick={() => navigator.clipboard.writeText(tokenAddress || "")}>
              <MdContentCopy />
            </button>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          {/* Basic Token Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-text-muted">Symbol</label>
              <div className="text-lg font-mono text-text-primary">{tokenData.type === "lsp7" ? tokenData.lsp7Data?.lsp4TokenSymbol : tokenData.erc20Data?.symbol}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-text-muted">Decimals</label>
              <div className="text-lg text-text-primary">{tokenData.decimals ?? 'N/A'}</div>
            </div>
          </div>

          {tokenData.totalSupply !== undefined && !small && (
            <div>
              <label className="text-sm font-medium text-text-muted">Total Supply</label>
              <div className="text-lg font-mono text-text-primary">
                {tokenData.decimals !== undefined && (
                  <span className="text-sm">
                    {((tokenData.totalSupply || 0n) / (10n ** BigInt(tokenData.decimals || 0))).toLocaleString()} {tokenData.type === "lsp7" ? tokenData.lsp7Data?.lsp4TokenSymbol : tokenData.erc20Data?.symbol}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* LSP7 Specific Information */}
          {tokenData.type === "lsp7" && !small && (
            <div className="border-t border-border pt-3 mt-3">
              <span className="text-sm font-medium text-text-muted">LSP4 Digital Asset Metadata</span>
            </div>
          )}

          {tokenData.type === "lsp7" && !small && tokenData.lsp7Data?.lsp4TokenType !== undefined && (
            <div>
              <label className="text-sm font-medium text-text-muted">LSP4 Token Type</label>
              <div className="text-lg">
                {tokenData.lsp7Data?.lsp4TokenType === 0n && <span className="text-xs px-2 py-0.5 rounded bg-green-500 text-white">Token</span>}
                {tokenData.lsp7Data?.lsp4TokenType === 1n && <span className="text-xs px-2 py-0.5 rounded bg-yellow-500 text-white">NFT</span>}
                {tokenData.lsp7Data?.lsp4TokenType === 2n && <span className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white">Collection</span>}
                {tokenData.lsp7Data?.lsp4TokenType > 2n && <span className="text-xs px-2 py-0.5 rounded bg-bg-muted text-text-primary">Custom ({tokenData.lsp7Data?.lsp4TokenType})</span>}
              </div>
            </div>
          )}

          {tokenData.type === "lsp7" && !small && tokenData.lsp7Data?.lsp4Creators && tokenData.lsp7Data?.lsp4Creators.length > 0 && (
            <div>
              <label className="text-sm font-medium text-text-muted">Creators</label>
              <div className="space-y-1">
                {tokenData.lsp7Data?.lsp4Creators.map((creator, index) => (
                  <div key={index} className="text-sm font-mono bg-bg-muted p-2 rounded text-text-primary">
                    {creator}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tokenData.type === "lsp7" && !small && tokenData.lsp7Data?.lsp4Metadata && (
            <div className="max-w-full">
              <label className="text-sm font-medium text-text-muted">Metadata</label>
              <details className="bg-bg-muted rounded mt-1">
                <summary className="p-2 text-sm font-medium cursor-pointer text-text-secondary">
                  View JSON Metadata
                </summary>
                <div className="p-2 text-xs max-h-56 overflow-auto">
                  <pre className="max-w-full max-h-56 text-text-secondary">
                    {JSON.stringify(tokenData.lsp7Data?.lsp4Metadata, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          )}

          {/* Debug Information */}
          {(tokenData.error || tokenData.lsp7Data?.errors?.otherError) && (
            <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded">
              <span className="text-sm">
                {tokenData.error?.message || tokenData.lsp7Data?.errors?.otherError}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
