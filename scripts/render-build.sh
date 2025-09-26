#!/bin/bash
set -e

echo "Starting Render build process..."

# Install dependencies
echo "Installing dependencies..."
npm ci

# Generate database migrations
echo "Generating database migrations..."
npm run db:generate

# Run database migrations
echo "Running database migrations..."
npm run db:migrate

# Build the Next.js application
echo "Building Next.js application..."
npm run build

echo "Build process completed successfully!"