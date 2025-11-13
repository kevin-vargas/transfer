FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build


FROM node:22-alpine AS runtime

RUN apk --no-cache add ca-certificates
RUN adduser -D -s /bin/sh api

WORKDIR /home/api

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

RUN chown -R api:api /home/api
USER api

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
