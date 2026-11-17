FROM node@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d
WORKDIR /opt/qa
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/qa/browsers
RUN node node_modules/playwright/cli.js install --with-deps chromium
COPY runner.mjs vitest.config.mjs vite.config.mjs tsconfig.json ./
USER 1000:1000
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/node", "/opt/qa/runner.mjs"]
