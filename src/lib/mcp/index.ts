import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSavedExpressions from "./tools/list-saved-expressions";
import listSavedVideos from "./tools/list-saved-videos";
import saveVideo from "./tools/save-video";
import deleteSavedVideo from "./tools/delete-saved-video";

// Direct Supabase host is required as the OAuth issuer; the project ref is
// inlined at build time and survives publish.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "nativeflow-mcp",
  title: "NativeFlow",
  version: "0.1.0",
  instructions:
    "Tools for NativeFlow, a Dutch-learning app built on native YouTube content. Read the signed-in user's saved sentences and expressions, list their saved videos, and add or remove videos from their library.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listSavedExpressions, listSavedVideos, saveVideo, deleteSavedVideo],
});
