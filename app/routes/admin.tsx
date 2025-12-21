import { Creator } from "~/views/creator";

export function meta() {
  return [
    { title: "Create License Entry" },
    { name: "description", content: "Create and publish license registry entries" },
  ];
}

export default function CreatePage() {
  return <Creator />;
}
