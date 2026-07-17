import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // This codebase uses setState-in-effect for legitimate client-only reads
      // (localStorage, matchMedia, initial data fetch) in several places.
      // Downgraded to warn rather than refactoring all of them right now.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
