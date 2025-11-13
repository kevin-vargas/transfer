FROM golang:1.21-alpine AS go-builder

WORKDIR /app
COPY go.mod ./
RUN go mod download

COPY *.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o gem .

FROM node:20-alpine

RUN apk add --no-cache python3 make g++

RUN npm install -g @google/gemini-cli

RUN adduser -D -s /bin/sh app
USER app
WORKDIR /home/app

COPY --from=go-builder /app/gem .

EXPOSE 8080

CMD ["./gem"]