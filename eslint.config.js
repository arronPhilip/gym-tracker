import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
export default defineConfig([globalIgnores(['dist','client','**/node_modules']), { files: ['src/**/*.{js,jsx,mjs}'], extends: [js.configs.recommended], languageOptions: { globals: { ...globals.browser, ...globals.node }, parserOptions: { ecmaFeatures: { jsx: true } } } }, { files: ['src/**/*.jsx'], extends: [reactHooks.configs.flat.recommended,reactRefresh.configs.vite] }, { files: ['server/**/*.{js,cjs}', 'scripts/**/*.mjs', '*.config.js'], extends: [js.configs.recommended], languageOptions: { globals: globals.node } }])
