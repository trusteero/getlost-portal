#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Database Reset Script${NC}"
echo -e "${YELLOW}========================${NC}"
echo ""

# Confirmation prompt
echo -e "${RED}⚠️  WARNING: This will delete:${NC}"
echo -e "${RED}   - Your database file${NC}"
echo -e "${RED}   - All migrations${NC}"
echo -e "${RED}   - All uploaded books, covers, and reports${NC}"
echo ""
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo -e "${YELLOW}Operation cancelled.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 1: Removing old database file...${NC}"
if [ -f "./db.sqlite" ]; then
    rm ./db.sqlite
    echo -e "${GREEN}✓ Database file deleted${NC}"
else
    echo "No database file found (might already be deleted)"
fi

echo ""
echo -e "${YELLOW}Step 2: Removing drizzle migrations folder...${NC}"
if [ -d "./drizzle" ]; then
    rm -rf ./drizzle
    echo -e "${GREEN}✓ Drizzle folder deleted${NC}"
else
    echo "No drizzle folder found (might already be deleted)"
fi

echo ""
echo -e "${YELLOW}Step 3: Clearing upload folders...${NC}"

# Clear uploads/books folder
if [ -d "./uploads/books" ]; then
    rm -rf ./uploads/books/*
    echo -e "${GREEN}✓ Books folder cleared${NC}"
else
    echo "No books folder found"
fi

# Clear uploads/covers folder
if [ -d "./uploads/covers" ]; then
    rm -rf ./uploads/covers/*
    echo -e "${GREEN}✓ Covers folder cleared${NC}"
else
    echo "No covers folder found"
fi

# Clear uploads/reports folder
if [ -d "./uploads/reports" ]; then
    rm -rf ./uploads/reports/*
    echo -e "${GREEN}✓ Reports folder cleared${NC}"
else
    echo "No reports folder found"
fi

echo ""
echo -e "${YELLOW}Step 4: Generating new migrations...${NC}"
npm run db:generate

echo ""
echo -e "${YELLOW}Step 5: Running migrations...${NC}"
npm run db:migrate

echo ""
echo -e "${YELLOW}Step 6: Initializing database...${NC}"
if [ -f "./scripts/init-db.js" ]; then
    npm run db:init
    echo -e "${GREEN}✓ Database initialized${NC}"
else
    echo "No init-db.js script found, skipping initialization"
fi

echo ""
echo -e "${GREEN}✅ Database reset complete!${NC}"
echo -e "${GREEN}Your database has been recreated with fresh migrations.${NC}"
echo ""
echo -e "${YELLOW}You may want to:${NC}"
echo "  1. Create admin users with: npm run make-admin"
echo "  2. Start the dev server with: npm run dev"