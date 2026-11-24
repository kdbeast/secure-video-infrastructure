import { createConfig } from "@siv/eslint-config";

export default createConfig({
  tsconfigRootDir: import.meta.dirname,
  kind: "web",
  envFiles: ["src/env/**"],
});
