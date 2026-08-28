---
trigger: glob
globs: **/*.vue
---

# Vue 3 Component Rules

- Vue 3 SFCs. Use `<script setup>` for new components when practical.
- `component-name-in-template-casing: PascalCase` (enforced).
- Filenames PascalCase. One component per file.
- Do not mutate props in new code (the ESLint rule is currently disabled but
  treat mutation as forbidden).
- Follow `vue/first-attribute-linebreak` conventions.
- Keep templates dumb; put logic in composables or the plugin's JS module.
