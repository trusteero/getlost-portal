#!/bin/bash
set -e

echo "Starting Render build process..."

# Install dependencies
echo "Installing dependencies..."
npm ci

# Generate database migrations
echo "Generating database migrations..."
npm run db:generate || echo "Warning: db:generate failed, continuing..."

# Skip database migrations during build (database not available)
# Migrations will run at runtime via init scripts
echo "Skipping database migrations during build (database only available at runtime)..."

# Build the Next.js application
echo "Building Next.js application..."
npm run build

echo "Build process completed successfully!"