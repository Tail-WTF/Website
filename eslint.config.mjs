import nextConfig from "eslint-config-next";
import unusedImports from "eslint-plugin-unused-imports";

const config = [
  ...nextConfig,
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "no-multi-spaces": [
        2,
        {
          ignoreEOLComments: true,
        },
      ],
      "unused-imports/no-unused-imports": "error",
    },
  },
];

export default config;
