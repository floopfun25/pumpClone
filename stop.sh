#!/bin/bash

# FloppFun Stop Script
# Stops both backend and frontend

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🛑 Stopping FloppFun...${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Function to kill process by PID file
kill_by_pid_file() {
    local pid_file=$1
    local service_name=$2

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠️  Stopping $service_name (PID: $pid)...${NC}"
            kill $pid 2>/dev/null || true
            sleep 2
            if ps -p $pid > /dev/null 2>&1; then
                echo -e "${RED}❌ Process still running, force killing...${NC}"
                kill -9 $pid 2>/dev/null || true
            fi
            echo -e "${GREEN}✅ $service_name stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  $service_name process not running${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}⚠️  No PID file found for $service_name${NC}"
    fi
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local service_name=$2
    local pid=$(lsof -ti:$port 2>/dev/null)

    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}⚠️  Found process on port $port (PID: $pid), stopping...${NC}"
        kill -9 $pid 2>/dev/null || true
        echo -e "${GREEN}✅ Stopped process on port $port${NC}"
    fi
}

# Stop by PID files first
kill_by_pid_file ".backend.pid" "Backend"
kill_by_pid_file ".frontend.pid" "Frontend"

# Also check ports to be sure
kill_port 8080 "Backend"
kill_port 3000 "Frontend"

# Clean up log files (optional, comment out if you want to keep logs)
# rm -f backend/backend.log frontend.log

echo -e "${GREEN}✅ All services stopped${NC}"
