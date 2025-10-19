import globals from "globals";

export default [
  {
    files: ["**/*.js"],
    languageOptions: { 
      sourceType: "commonjs",
      ecmaVersion: 2020,
      globals: {
        ...globals.node,
        ...globals.es2020
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "no-undef": "error"
    }
  },
  {
    files: ["test/**/*.js"],
    languageOptions: { 
      sourceType: "commonjs",
      ecmaVersion: 2020,
      globals: {
        ...globals.node,
        ...globals.jest
      }
    }
  }
];
