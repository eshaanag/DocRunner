FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 bash ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /docrunner

COPY package.json package-lock.json ./
COPY packages/cli/package.json packages/cli/package.json
COPY packages/dashboard/package.json packages/dashboard/package.json
RUN npm ci

COPY packages/cli packages/cli
RUN npm run build --workspace @eshaanag/docrunner \
  && npm install --global ./packages/cli

COPY action/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER node
ENTRYPOINT ["/entrypoint.sh"]
