FROM node:22-alpine AS build
WORKDIR /app
COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
COPY server/package.json server/tsconfig.json ./server/
COPY server/src ./server/src
COPY package.json package-lock.json ./
# 避免根目錄 devDep 的 playwright 在安裝時下載瀏覽器（拖慢/失敗 build）
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# 裝整個 monorepo（含根目錄 devDeps 的 typescript），否則 build shared 會找不到 tsc（exit 127）
RUN npm ci
RUN npm run build -w @bnb/shared && npm run build -w @bnb/server

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/node_modules ./node_modules
WORKDIR /app/server
EXPOSE 8787
CMD ["node", "dist/index.js"]
