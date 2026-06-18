/* eslint-disable no-undef */
import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";
import replace from "@rollup/plugin-replace";

const sdkUrl = process.env.SDK_URL ?? "";
const isLocalBuild =
  sdkUrl.includes("localhost") || sdkUrl.includes("127.0.0.1") || sdkUrl.includes("[::1]");
/** Staging widget — dist-dev/ (published; loaded by embed-dev.js from unpkg). */
const isStagingWidget = sdkUrl.includes("dev-widget");
const outputDir = isLocalBuild ? "dist-local" : isStagingWidget ? "dist-dev" : "dist";

const API_URL =
  process.env.API_URL ??
  (isLocalBuild
    ? "http://127.0.0.1:8000/api/v1"
    : isStagingWidget
      ? "https://api-staging.alphablocks.ai/api/v1"
      : "https://api-prod.alphablocks.ai/api/v1");

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
      targets: [
        { src: "src/styles.css", dest: outputDir },
        { src: "embed.js", dest: outputDir },
      ],
    }),
  ],
};

export default config;
