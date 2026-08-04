// eslint.config.js
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/src-tauri/target/**',
      '**/data/**',
      '**/vendor/**',
    ],
  },
  ...tseslint.configs.recommended,
  eslintConfigPrettier
)
