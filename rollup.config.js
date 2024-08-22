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
};

export default config;
