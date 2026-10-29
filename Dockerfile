# Multi-stage Dockerfile for TOR Evidence & Handover Report System
FROM node:22-bookworm-slim AS base

# Install Chromium and Thai fonts for PDF rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-thai-tlwg \
    fonts-noto-cjk \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium
ENV PORT=5000
ENV NODE_ENV=production

WORKDIR /app

# Copy package definitions
COPY package.json package-lock.json* ./
COPY server/package.json server/package-lock.json* ./server/
COPY client/package.json client/package-lock.json* ./client/

# Install dependencies
RUN npm --prefix client install
RUN npm --prefix server install

# Copy source files
COPY client/ ./client/
COPY server/ ./server/

# Build client and server
RUN npm --prefix client run build
RUN npm --prefix server run build

# Expose port
EXPOSE 5000

# Volume for persistent SQLite DB and uploaded media
VOLUME ["/app/server/storage"]

WORKDIR /app/server
CMD ["npm", "start"]
