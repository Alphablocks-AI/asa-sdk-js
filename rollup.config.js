import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";

const config = {
  input: "src/index.ts",
  output: [
    {
      file: "dist/index.umd.js",
      format: "umd",
      name: "AlphaBlocks",
    },
    {
      file: `dist/index.cjs.js`,
      format: "cjs",
      sourcemap: true,
    },
    {
      file: `dist/index.mjs`,
      format: "es",
      sourcemap: true,
    },
  ],
  plugins: [
    typescript(),
    copy({
      targets: [{ src: "src/styles.css", dest: "dist" }],
    }),
  ],
};

export default config;
