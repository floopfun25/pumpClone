#!/bin/bash

# FloppFun Backend Quick Setup Script
# This script automates the backend setup process

set -e  # Exit on error

echo "🚀 FloppFun Backend Quick Setup"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Homebrew is installed
echo "📦 Checking for Homebrew..."
if ! command -v brew &> /dev/null; then
    echo -e "${YELLOW}Homebrew not found. Installing...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add Homebrew to PATH
    if [[ $(uname -m) == 'arm64' ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
        eval "$(/opt/homebrew/bin/brew shellenv)"
    else
        echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zshrc
        eval "$(/usr/local/bin/brew shellenv)"
    fi

    echo -e "${GREEN}✓ Homebrew installed${NC}"
else
    echo -e "${GREEN}✓ Homebrew found${NC}"
fi

# Check if Maven is installed
echo ""
echo "📦 Checking for Maven..."
if ! command -v mvn &> /dev/null; then
    echo -e "${YELLOW}Maven not found. Installing...${NC}"
    brew install maven
    echo -e "${GREEN}✓ Maven installed${NC}"
else
    echo -e "${GREEN}✓ Maven found: $(mvn -version | head -1)${NC}"
fi

# Check if PostgreSQL is installed
echo ""
echo "📦 Checking for PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}PostgreSQL not found. Installing...${NC}"
    brew install postgresql@15
    brew services start postgresql@15
    echo -e "${GREEN}✓ PostgreSQL installed and started${NC}"
else
    echo -e "${GREEN}✓ PostgreSQL found: $(psql --version)${NC}"
    # Check if service is running
    if brew services list | grep postgresql | grep started > /dev/null; then
        echo -e "${GREEN}✓ PostgreSQL service is running${NC}"
    else
        echo -e "${YELLOW}Starting PostgreSQL service...${NC}"
        brew services start postgresql@15
    fi
fi

# Create database
echo ""
echo "🗄️  Setting up database..."
if psql postgres -c "SELECT 1 FROM pg_database WHERE datname = 'floppfun';" | grep -q 1; then
    echo -e "${GREEN}✓ Database 'floppfun' already exists${NC}"
else
    echo "Creating database 'floppfun'..."
    psql postgres -c "CREATE DATABASE floppfun;"
    psql postgres -c "CREATE USER floppfun_user WITH ENCRYPTED PASSWORD 'floppfun123';"
    psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE floppfun TO floppfun_user;"
    echo -e "${GREEN}✓ Database created${NC}"
    echo -e "${YELLOW}Default credentials: username=floppfun_user, password=floppfun123${NC}"
fi

# Configure .env file
echo ""
echo "⚙️  Configuring .env file..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ .env file created from .env.example${NC}"

        # Update .env with defaults
        sed -i.bak 's/DB_USERNAME=postgres/DB_USERNAME=floppfun_user/' .env
        sed -i.bak 's/DB_PASSWORD=your_password_here/DB_PASSWORD=floppfun123/' .env
        sed -i.bak 's/JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars/JWT_SECRET=floppfun-jwt-secret-key-for-development-32-chars-minimum/' .env
        rm .env.bak

        echo -e "${YELLOW}⚠️  Remember to update PINATA API keys in .env for IPFS uploads${NC}"
    else
        echo -e "${RED}✗ .env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Build the project
echo ""
echo "🔨 Building backend..."
mvn clean install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful!${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# Summary
echo ""
echo "================================"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "================================"
echo ""
echo "📋 Next Steps:"
echo "  1. Start the backend:"
echo "     mvn spring-boot:run"
echo ""
echo "  2. Test the API:"
echo "     curl http://localhost:8080/api/actuator/health"
echo ""
echo "  3. Update Pinata API keys in .env for IPFS uploads"
echo ""
echo "🌐 Backend will run on: http://localhost:8080/api"
echo ""
