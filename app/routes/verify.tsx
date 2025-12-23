import Verifier from "~/views/verifier/Verifier";

export function meta() {
  return [
    { title: "Verify Registry Update" },
    { name: "description", content: "Verify proposed registry updates before governance votes" },
  ];
}

export default function VerifyRoute() {
  return <Verifier />;
}

