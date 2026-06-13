FROM node:lts-alpine

WORKDIR /app

# Install dependencies (sql.js is pure JS, no build tools needed)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000

# Run with default command; SESSION_SECRET passed via environment
CMD ["node", "server.js"]
