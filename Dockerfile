FROM node:20-slim

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the app (frontend + backend)
RUN npm run build

# Expose the port Railway will assign
ENV PORT=3000
EXPOSE 3000

# Start the production server
CMD ["node", "dist/index.cjs"]
