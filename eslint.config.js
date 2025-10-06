const { FlatCompat } = require("@eslint/eslintrc");

// FlatCompat requires `recommendedConfig` and `allConfig` in newer @eslint/eslintrc
// versions. Provide them by requiring ESLint's shipped configs so compat can work.
// Use the official @eslint/js package configs which export recommended/all
const { configs: eslintJsConfigs } = require("@eslint/js");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: eslintJsConfigs.recommended,
    allConfig: eslintJsConfigs.all
});

// Load the BandLab base config object, patch any rule-name incompatibilities
// (some versions of @stylistic renamed rules, e.g. func-call-spacing -> function-call-spacing)
const bandlabBasePath = require.resolve("@bandlab/eslint-config-bandlab-base/rules/base.js");
const bandlabBase = require(bandlabBasePath);

if (bandlabBase && bandlabBase.rules) {
    const patched = {};
    for (const [key, val] of Object.entries(bandlabBase.rules)) {
        let newKey = key;
        // specific mapping for renamed rule in @stylistic
        if (key === "@stylistic/func-call-spacing") {
            newKey = "@stylistic/function-call-spacing";
        }
        patched[newKey] = val;
    }
    bandlabBase.rules = patched;
}

// Convert the patched eslintrc-style config into a flat-config using FlatCompat
module.exports = compat.config(bandlabBase);