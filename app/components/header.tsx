import type { CommunityInfoResponsePayload } from "@common-ground-dao/cg-plugin-lib";
import { useCgData } from "~/context/cg_data";

export default function Header() {
  const { communityInfo } = useCgData();

  return (
    <div className="p-4 flex gap-2 justify-between flex-wrap">
      <div className="flex flex-row items-center justify-start gap-3">
        {!!communityInfo && <CommunityInfo communityInfo={communityInfo} />}
      </div>
    </div>
  );
}

function CommunityInfo({ communityInfo }: { communityInfo: CommunityInfoResponsePayload }) {
  if (!communityInfo.smallLogoUrl && !communityInfo.largeLogoUrl && !communityInfo.title) return null;

  return (<>
    <div className="rounded-xl w-10 h-10 overflow-hidden">
      <img src={communityInfo.smallLogoUrl || communityInfo.largeLogoUrl} />
    </div>
    <div className="text-xl font-bold text-text-primary">
      {communityInfo.title}
    </div>
  </>)
}
