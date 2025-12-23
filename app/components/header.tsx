import { getConfiguredEnsName } from "~/lib/ens";

export default function Header() {
  const ensName = getConfiguredEnsName();

  return (
    <div className="p-4 flex gap-2 justify-between flex-wrap">
      <div className="flex flex-row items-center justify-start gap-3">
        {ensName && (
          <>
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="text-xl font-bold text-text-primary font-mono">
              {ensName}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
