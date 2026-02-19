FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN npm install --workspace=server --workspace=shared --omit=dev
COPY shared/ shared/
COPY server/ server/

FROM node:20-slim
WORKDIR /app
COPY --from=build /app ./
ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 10000
CMD ["npm", "run", "start", "--workspace=server"]
