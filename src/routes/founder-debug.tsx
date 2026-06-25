import { createFileRoute } from "@tanstack/react-router";
import { FounderGate, FounderDebugPage } from "./founder";

export const Route = createFileRoute("/founder-debug")({
  head: () => ({
    meta: [{ title: "Founder Debug" }, { name: "robots", content: "noindex" }],
  }),
  ssr: false,
  component: () => <FounderGate Page={FounderDebugPage} />,
  errorComponent: ({ error }) => (
    <div className="p-6 text-red-600">Error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});
