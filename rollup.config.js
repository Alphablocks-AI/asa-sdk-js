/* eslint-disable no-undef */
import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";
import replace from "@rollup/plugin-replace";

const isDev = process.env.SDK_URL.includes("dev-widget");
const outputDir = isDev ? "dist-dev" : "dist";

const API_URL = isDev
  ? "https://api-staging.alphablocks.ai/api/v1"
  : "https://api-prod.alphablocks.ai/api/v1";

const config = {
  input: "src/index.ts",
  output: [
    {
      file: `${outputDir}/index.umd.js`,
      format: "umd",
      name: "AlphaBlocks",
    },
    {
      file: `${outputDir}/index.cjs.js`,
      format: "cjs",
      sourcemap: true,
    },
    {
      file: `${outputDir}/index.mjs`,
      format: "es",
      sourcemap: true,
    },
  ],
  plugins: [
    replace({
      "process.env.SDK_URL": JSON.stringify(process.env.SDK_URL),
      "process.env.API_URL": JSON.stringify(API_URL),
    }),
    typescript(),
    copy({
      targets: [{ src: "src/styles.css", dest: "dist" }],
    }),
  ],
};

export default config;
