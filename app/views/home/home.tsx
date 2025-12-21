/**
 * Home Page
 * 
 * Displays the license registry viewer.
 */

import { RegistryViewer } from "~/views/registry";

export default function Home() {
  return (
    <div className="flex flex-col gap-4 flex-1">
      <RegistryViewer />
    </div>
  );
}
