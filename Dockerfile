FROM node:20-slim

WORKDIR /app

# Copy package files and remove packageManager to avoid corepack auto-activation
COPY package.json pnpm-lock.yaml ./
RUN sed -i '/"packageManager"/d' package.json

# Install pnpm directly via npm
RUN npm install -g pnpm@10.4.1

# Install dependencies and build
RUN pnpm install --no-frozen-lockfile

COPY . .
RUN NODE_ENV=production pnpm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["pnpm", "start"]
