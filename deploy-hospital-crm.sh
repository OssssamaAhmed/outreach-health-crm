#!/bin/bash

# Hospital CRM Deployment Automation Script
# This script automates the update and deployment process to Railway.com

set -e  # Exit on error

echo "=========================================="
echo "Hospital CRM - Deployment Automation"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="${1:-.}"
COMMIT_MESSAGE="${2:-Deploy: Automated update and rebuild}"

echo -e "${YELLOW}Step 1: Validating project directory...${NC}"
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    echo -e "${RED}Error: package.json not found in $PROJECT_DIR${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Project directory validated${NC}"
echo ""

echo -e "${YELLOW}Step 2: Checking Git status...${NC}"
cd "$PROJECT_DIR"
git status
echo ""

echo -e "${YELLOW}Step 3: Installing dependencies...${NC}"
pnpm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 4: Running type check...${NC}"
pnpm check || echo -e "${YELLOW}⚠ Type check warnings (continuing)${NC}"
echo ""

echo -e "${YELLOW}Step 5: Building application...${NC}"
pnpm build
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

echo -e "${YELLOW}Step 6: Staging changes...${NC}"
git add -A
echo -e "${GREEN}✓ Changes staged${NC}"
echo ""

echo -e "${YELLOW}Step 7: Committing changes...${NC}"
if git diff --cached --quiet; then
    echo -e "${YELLOW}No changes to commit${NC}"
else
    git commit -m "$COMMIT_MESSAGE"
    echo -e "${GREEN}✓ Changes committed${NC}"
fi
echo ""

echo -e "${YELLOW}Step 8: Pushing to GitHub...${NC}"
git push origin main
echo -e "${GREEN}✓ Changes pushed to GitHub${NC}"
echo ""

echo -e "${GREEN}=========================================="
echo "Deployment initiated successfully!"
echo "Railway will automatically rebuild your app."
echo "Check: https://railway.com/project/aa084576-372a-4754-8cf7-6d35b743e7ce"
echo "==========================================${NC}"
echo ""

