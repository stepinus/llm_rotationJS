# Use Node.js LTS version as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port (default 3000, can be overridden with PORT env var)
EXPOSE 3000

# # Create non-root user for security
# RUN addgroup -g 1001 -S nodejs
# RUN adduser -S nodejs -u 1001

# # Change ownership of the app directory
# RUN chown -R nodejs:nodejs /app
# USER nodejs

# Start the server
CMD ["npm", "start"]