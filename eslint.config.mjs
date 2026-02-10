import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(eslint.configs.recommended, ...tseslint.configs.recommendedTypeChecked, {
    languageOptions: {
        globals: {
            ...globals.browser,
        },
        parserOptions: {
            projectService: true,
            tsconfigRootDir: __dirname,
        },
    },

    rules: {
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
        "no-prototype-builtins": "warn",
        "@typescript-eslint/no-unused-vars": [
            "warn",
            {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
            },
        ],
        "@typescript-eslint/ban-ts-comment": "warn",
        "@typescript-eslint/no-empty-object-type": "warn",
        "@typescript-eslint/no-unsafe-assignment": "warn",
        "@typescript-eslint/no-unsafe-member-access": "warn",
        "@typescript-eslint/no-unsafe-call": "warn",
        "@typescript-eslint/no-unsafe-return": "warn",
        "@typescript-eslint/no-unsafe-argument": "warn",
    },
});
