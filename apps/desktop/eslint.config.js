// ESLint flat config.
//
// Beyond baseline JS/TS correctness, this enforces the architecture boundaries
// from TECH_ARCHITECTURE.md §2.2 via `import/no-restricted-paths`. The zones
// below reference directories that don't exist yet (ui/, domain/, core/,
// store/, features/) — they're declared now so the rule takes effect
// automatically as those directories are populated in later Phase 1 tasks,
// instead of being bolted on retroactively.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'

// Known feature slices per TECH_ARCHITECTURE §2.2 — features must not import
// each other directly; they communicate through the store.
const FEATURES = ['start', 'studio', 'design', 'captions', 'transport', 'export', 'preview']

export default tseslint.config(
  {
    ignores: ['dist/**', 'src-tauri/**', 'node_modules/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,

  {
    rules: {
      // Legacy components (pre-Phase-1) are messy by design — surface these
      // as signal, not as a wall that blocks every other task's lint gate.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-expressions': ['error', {
        allowShortCircuit: true, // `cond && doThing()`
        allowTernary: true,      // `cond ? doThing() : doOtherThing()` used for its side effect
      }],
      'import/no-unresolved': 'off', // vite/tauri virtual specifiers trip this up; tsc already covers resolution
      'import/named': 'off', // duplicates tsc's own type-checking, prone to false positives on re-exports

      // The one rule this config exists for: architecture boundaries.
      'import/no-restricted-paths': ['error', {
        zones: [
          {
            target: './src/ui/**/*',
            from: ['./src/store/**/*', './src/features/**/*', './src/core/**/*', './src/app/**/*'],
            message: 'ui/ is a dumb primitive layer — it must not depend on store, features, core, or app.',
          },
          {
            target: './src/domain/**/*',
            from: ['./src/store/**/*', './src/features/**/*', './src/core/**/*', './src/app/**/*', './src/ui/**/*'],
            message: 'domain/ must stay pure TypeScript with zero app dependencies — it is the layer everything else is tested against.',
          },
          {
            target: './src/core/**/*',
            from: ['./src/features/**/*', './src/app/**/*', './src/store/**/*'],
            message: 'core/ is app infrastructure below the store/features layer — it must not depend on them.',
          },
          ...FEATURES.map(f => ({
            target: `./src/features/${f}/**/*`,
            from: FEATURES.filter(x => x !== f).map(x => `./src/features/${x}/**/*`),
            message: `features/${f} must not import another feature directly — route shared state through the store.`,
          })),
        ],
      }],

      // Direct Tauri IPC calls belong in core/ipc only, so the rest of the
      // app talks to one typed facade instead of scattering invoke() calls.
      'no-restricted-imports': ['warn', {
        paths: [{
          name: '@tauri-apps/api/core',
          message: 'Import from core/ipc instead of calling @tauri-apps/api/core directly (TECH_ARCHITECTURE §2.3). Still a warning in Phase 1 — legacy Step components have not been migrated yet.',
        }],
      }],
    },
  },

  // core/ (including core/ipc, the one place allowed to touch the raw Tauri
  // API) fully replaces the base tauri-import warning above with a React
  // ban instead — core/ is non-UI app infrastructure.
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'react', message: 'core/ is non-UI app infrastructure — it must not depend on React.' }],
      }],
    },
  },
)
