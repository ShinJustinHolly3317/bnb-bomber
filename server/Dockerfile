FROM node:22-alpine AS build
WORKDIR /app
COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
COPY server/package.json server/tsconfig.json ./server/
COPY server/src ./server/src
COPY package.json package-lock.json ./
RUN npm ci --workspace=@bnb/shared --workspace=@bnb/server
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
