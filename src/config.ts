import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-queue",
  displayName: "Queue",
  visualProfile: "utility",
  shellLayout: "inset",
  description: "A shared take-a-number queue that works directly between browsers.",
  accentHex: "#7ea5ff",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
