# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = { host: 'localhost', port: 8080, timeout: 2000 }; const request = http.request(options, (res) => { res.statusCode === 200 ? process.exit(0) : process.exit(1); }); request.on('error', () => process.exit(1)); request.end();"

# Start the server
CMD ["yarn", "start"]
