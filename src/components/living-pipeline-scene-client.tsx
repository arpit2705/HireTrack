"use client";

import dynamic from "next/dynamic";

// Dynamic import with ssr:false must live inside a Client Component.
// This thin wrapper is imported by the Server Component landing page.
const LivingPipelineSceneInner = dynamic(
  () =>
    import("@/components/living-pipeline-scene").then(
      (m) => m.LivingPipelineScene
    ),
  { ssr: false }
);

export function LivingPipelineSceneClient() {
  return <LivingPipelineSceneInner />;
}
