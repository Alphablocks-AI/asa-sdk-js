import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";
import replace from "@rollup/plugin-replace";

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
    replace({
      // eslint-disable-next-line no-undef
      "process.env.SDK_URL": JSON.stringify(process.env.SDK_URL),
    }),
    typescript(),
    copy({
      targets: [{ src: "src/styles.css", dest: "dist" }],
    }),
  ],
};

export default config;
