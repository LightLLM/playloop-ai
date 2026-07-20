FROM docker.io/cloudflare/sandbox:0.12.3
USER root
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npm install -g npm@11.6.2 typescript@5.9.3 vite@8.0.13 @playwright/test@1.58.2 \
    && npx playwright install --with-deps chromium \
    && chmod -R a+rX /ms-playwright
USER sandbox
WORKDIR /workspace
