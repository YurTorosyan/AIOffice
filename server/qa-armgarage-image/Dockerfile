# Build context: server/. Coffee House's image, files and pinned reference are unchanged.
FROM node@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d
WORKDIR /opt/qa
COPY qa-web-image/package.json qa-web-image/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/qa/browsers
RUN node node_modules/playwright/cli.js install --with-deps chromium
COPY qa-web-image/runner.mjs ./legacy-runner.mjs
COPY qa-web-image/vitest.config.mjs qa-web-image/vite.config.mjs qa-web-image/tsconfig.json ./
COPY qa-armgarage-image/runner.mjs qa-armgarage-image/browser-contract.mjs qa-armgarage-image/catalog.mjs ./
COPY qa-armgarage-image/vitest.config.mjs qa-armgarage-image/armgarage-domain.test.mjs ./
USER 1000:1000
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/node", "/opt/qa/runner.mjs"]
