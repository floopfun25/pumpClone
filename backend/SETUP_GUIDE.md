# Backend Setup Guide - FloppFun

This guide will help you set up and run the Spring Boot backend.

## Prerequisites Installation

### 1. Install Homebrew (Package Manager for macOS)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# After installation, add to PATH (for Apple Silicon):
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc
```

### 2. Install Maven

```bash
brew install maven

# Verify installation
mvn -version
```

### 3. Install PostgreSQL

```bash
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Verify installation
psql --version
```

## Database Setup

### Create the Database

```bash
# Connect to PostgreSQL (default user)
psql postgres

# In PostgreSQL shell, run:
CREATE DATABASE floppfun;
CREATE USER floppfun_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE floppfun TO floppfun_user;

# Exit PostgreSQL
\q
```

### Test Database Connection

```bash
psql -U floppfun_user -d floppfun
# Enter password when prompted
# If successful, you'll see: floppfun=>
# Type \q to exit
```

## Backend Configuration

### Update .env File

Edit `backend/.env` with your database credentials:

```bash
cd backend
nano .env
```

**Required changes:**

```properties
# Database Configuration
DB_USERNAME=floppfun_user
DB_PASSWORD=your_secure_password

# JWT Configuration (must be at least 32 characters)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-change-this

# Solana Configuration (already set)
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

# IPFS Configuration (get keys from https://pinata.cloud)
PINATA_API_KEY=your_pinata_api_key_here
PINATA_SECRET_KEY=your_pinata_secret_key_here
```

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

## Build and Run Backend

### 1. Build the Project

```bash
cd /Users/fatih/Projekte/Flopfun/pumpClone/backend
mvn clean install
```

This will:
- Download all dependencies
- Compile Java code
- Run tests
- Create a JAR file in `target/` directory

### 2. Run the Backend

```bash
mvn spring-boot:run
```

The backend will start on **http://localhost:8080/api**

### 3. Verify Backend is Running

Open a new terminal and test:

```bash
# Health check
curl http://localhost:8080/api/actuator/health

# Should return: {"status":"UP"}
```

## Troubleshooting

### Port 8080 Already in Use

```bash
# Find process using port 8080
lsof -i :8080

# Kill the process (replace PID with actual process ID)
kill -9 PID
```

### Database Connection Failed

```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Restart PostgreSQL
brew services restart postgresql@15

# Check logs
tail -f /opt/homebrew/var/log/postgresql@15.log
```

### Maven Build Fails

```bash
# Clear Maven cache
rm -rf ~/.m2/repository

# Try building again
mvn clean install -U
```

## Alternative: Run Without PostgreSQL (H2 In-Memory Database)

For quick testing without PostgreSQL:

1. Comment out PostgreSQL in `application.yml`:

```yaml
# spring:
#   datasource:
#     url: jdbc:postgresql://localhost:5432/floppfun
```

2. Add H2 database dependency to `pom.xml` (if not already present):

```xml
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>runtime</scope>
</dependency>
```

3. Update `application.yml`:

```yaml
spring:
  datasource:
    url: jdbc:h2:mem:testdb
    driver-class-name: org.h2.Driver
  h2:
    console:
      enabled: true
```

4. Run: `mvn spring-boot:run`

H2 Console available at: http://localhost:8080/api/h2-console

## Quick Start (One Command After Setup)

Once everything is installed:

```bash
cd /Users/fatih/Projekte/Flopfun/pumpClone/backend && mvn spring-boot:run
```

## API Endpoints

Once running, test these endpoints:

- **Health:** http://localhost:8080/api/actuator/health
- **Tokens List:** http://localhost:8080/api/tokens
- **Token by ID:** http://localhost:8080/api/tokens/1
- **WebSocket:** ws://localhost:8080/api/ws

## Next Steps

1. ✅ Install Homebrew
2. ✅ Install Maven and PostgreSQL
3. ✅ Create database
4. ✅ Configure .env
5. ✅ Build and run backend
6. 🔗 Connect frontend to backend (frontend already configured)

---

**Need Help?** Check the logs in the terminal for error messages.
