import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-queue",
  description: "A shared take-a-number queue that works directly between browsers.",
  accentHex: "#f97316",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
