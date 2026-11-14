# Working on Quiet List

- Keep this a small static HTML/CSS/JavaScript app. Runtime changes do not need a framework or backend.
- Preserve the four required actions: add, toggle completion, delete, and retain tasks after reload. Keep existing quiet-list:v1 data compatible.
- Render task text as text, validate storage data, and show honest storage failures.
- Preserve keyboard focus when re-rendering task rows. Review empty, filtered, error and narrow-screen states.
- Read DESIGN.md before UI changes. Use tokens.css and the local Onest fonts. Keep the form and list central, and verify both color modes. Theme storage is independent from task storage.
- Node >=22.12 is required for tooling; Node 24 LTS is recommended. Run npm ci, npm run format:check, npm test and npm run test:e2e after meaningful changes. Install browsers with npx playwright install chromium webkit if needed.
- Browser verification must include actual interactions and screenshots. Do not report a test as passed merely because its file exists.
