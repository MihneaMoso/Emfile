import nextPlugin from "eslint-config-next";

const config = [
  ...nextPlugin,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "drizzle/**",
      "public/vendor/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
