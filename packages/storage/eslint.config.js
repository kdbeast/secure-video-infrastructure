import { createConfig } from "@siv/eslint-config";

export default createConfig({
  tsconfigRootDir: import.meta.dirname,
  s3Sdk: true,
});
