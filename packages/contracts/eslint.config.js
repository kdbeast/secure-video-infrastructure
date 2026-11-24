import { createConfig } from "@siv/eslint-config";

export default createConfig({
  tsconfigRootDir: import.meta.dirname,
  browserSafe: true,
});
