#!/bin/bash

# FloppFun Startup Script
# Starts both backend and frontend with proper environment variables

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting FloppFun...${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Function to load .env file and export variables
load_env() {
    local env_file=$1
    if [ -f "$env_file" ]; then
        echo -e "${GREEN}✅ Loading environment from: $env_file${NC}"
        # Export variables from .env file
        export $(grep -v '^#' "$env_file" | grep -v '^$' | xargs)
    else
        echo -e "${RED}❌ Environment file not found: $env_file${NC}"
        exit 1
    fi
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}⚠️  Killing existing process on port $port (PID: $pid)${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Kill any existing processes
echo -e "${BLUE}🧹 Cleaning up existing processes...${NC}"
kill_port 8080  # Backend
kill_port 3000  # Frontend

# Load backend environment variables
echo -e "${BLUE}📦 Setting up backend...${NC}"
load_env "$SCRIPT_DIR/backend/.env"

# Start backend in background with Java 21
echo -e "${GREEN}🟢 Starting backend on port 8080...${NC}"
cd "$SCRIPT_DIR/backend"
# Set JAVA_HOME to Java 21 for compatibility
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
mvn spring-boot:run > backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"

# Wait for backend to be ready
echo -e "${YELLOW}⏳ Waiting for backend to start...${NC}"
sleep 5
for i in {1..30}; do
    if curl -s http://localhost:8080/api/actuator/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Backend failed to start. Check backend.log for details.${NC}"
        tail -n 50 backend.log
        exit 1
    fi
    sleep 2
done

# Start frontend
echo -e "${GREEN}🟢 Starting frontend on port 3000...${NC}"
cd "$SCRIPT_DIR"
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"

# Wait for frontend to be ready
echo -e "${YELLOW}⏳ Waiting for frontend to start...${NC}"
sleep 5
for i in {1..30}; do
    if curl -s http://localhost:3000/pumpClone/ > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Frontend failed to start. Check frontend.log for details.${NC}"
        tail -n 50 frontend.log
        exit 1
    fi
    sleep 2
done

# Success message
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  ✅ FloppFun is running!                                 ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  🌐 Frontend: ${BLUE}http://localhost:3000/pumpClone/${GREEN}       ║${NC}"
echo -e "${GREEN}║  🔧 Backend:  ${BLUE}http://localhost:8080/api${GREEN}              ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  📊 Backend PID:  $BACKEND_PID                                    ║${NC}"
echo -e "${GREEN}║  📊 Frontend PID: $FRONTEND_PID                                    ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  📝 Logs:                                                ║${NC}"
echo -e "${GREEN}║     Backend:  backend/backend.log                        ║${NC}"
echo -e "${GREEN}║     Frontend: frontend.log                               ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  To stop: Press Ctrl+C or run ./stop.sh                 ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Save PIDs to file for stop script
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid

# Wait for user interrupt
trap 'echo -e "\n${YELLOW}⚠️  Shutting down...${NC}"; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; rm -f .backend.pid .frontend.pid; echo -e "${GREEN}✅ Stopped${NC}"; exit 0' INT TERM

# Keep script running and tail logs
echo -e "${BLUE}📋 Showing logs from both services (Ctrl+C to stop)...${NC}"
echo -e "${YELLOW}Use 'tail -f backend/backend.log' or 'tail -f frontend.log' in separate terminals for individual logs${NC}"
echo ""

# Use multitail if available, otherwise use regular tail with prefixes
if command -v multitail &> /dev/null; then
    multitail -l "tail -f backend/backend.log" -l "tail -f frontend.log"
else
    # Tail both files with labels
    tail -f backend/backend.log frontend.log | awk '
        /^==> backend\/backend.log <==/ {
            printf "\n\033[0;34m[BACKEND]\033[0m "
            next
        }
        /^==> frontend.log <==/ {
            printf "\n\033[0;32m[FRONTEND]\033[0m "
            next
        }
        /backend\/backend.log/ {
            printf "\033[0;34m[BACKEND]\033[0m %s\n", $0
            next
        }
        /frontend.log/ {
            printf "\033[0;32m[FRONTEND]\033[0m %s\n", $0
            next
        }
        {
            print $0
        }
    '
fi
