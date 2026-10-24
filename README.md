# DeskSpacing

A static Three.js desk setup planner. The existing pages and models are retained.

Use Node **24.22.1** (`nvm use`, if nvm is installed), then:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally <http://127.0.0.1:5173>).

```sh
npm run lint
npm run format:check
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

`test:e2e` builds first and starts its own production preview. `npm run check`
combines lint, formatting, unit tests, production build and browser tests; install
Chromium first. On Linux, use `npx playwright install --with-deps chromium`.

The static production site is in `dist/`. No deployment runs automatically.
See [application architecture](docs/ARCHITECTURE.md),
[development and hosting](docs/DEVELOPMENT.md),
[dependency compatibility](docs/DEPENDENCIES.md), and the original
[modernization plan](docs/MODERNIZATION_PLAN.md).
