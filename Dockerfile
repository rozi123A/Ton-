FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .
RUN NODE_ENV=production npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
