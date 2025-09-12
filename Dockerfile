# Use Playwright image with browsers and dependencies preinstalled
FROM mcr.microsoft.com/playwright:v1.55.0-jammy
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm ci || npm install

# Copy source code
COPY . .

# Build server (tests remain TS and run via Playwright)
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4001
CMD ["node", "dist/server.js"]
