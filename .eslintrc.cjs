module.exports = {
  root: true,
  extends: ["eslint:recommended"],
  ignorePatterns: [".eslintrc.cjs", "*.js", "rand"],
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      env: { browser: true, es6: true, node: true },
      extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier",
      ],
      globals: { Atomics: "readonly", SharedArrayBuffer: "readonly" },
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 2018,
        sourceType: "module",
        project: [
          "./tsconfig.json",
          "./test/tsconfig.json",
        ],
      },
      plugins: ["@typescript-eslint"],
      rules: {
        "no-constant-condition": ["error", { checkLoops: false }],

        "@typescript-eslint/no-explicit-any": 0,

        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/require-await": "error",
        "@typescript-eslint/no-misused-promises": [
          "error",
          {
            checksVoidReturn: {
              attributes: false,
            },
          },
        ],

        "@typescript-eslint/restrict-plus-operands": "error",
        "@typescript-eslint/no-base-to-string": "error",
        "@typescript-eslint/restrict-template-expressions": "error",

        "no-unsafe-optional-chaining": [
          "error",
          { disallowArithmeticOperators: true },
        ],

        "@typescript-eslint/no-unused-vars": "warn",
      },
    },
  ],
}
