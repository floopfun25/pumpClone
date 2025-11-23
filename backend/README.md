# FloppFun Backend - Spring Boot API

A professional Spring Boot backend for the FloppFun pump.fun clone on Solana.

## 🚀 Quick Start

### Prerequisites
- Java 17 or higher
- Maven 3.6+
- PostgreSQL 14+
- Redis (optional, for caching)
- Solana CLI tools (for development)

### Setup

1. **Clone and navigate to backend**
```bash
cd backend
```

2. **Configure Database**

Create a PostgreSQL database:
```sql
CREATE DATABASE floppfun;
```

3. **Set Environment Variables**

Create `.env` file or set these variables:
```bash
# Database
DB_USERNAME=postgres
DB_PASSWORD=your_password

# Solana
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
BONDING_CURVE_PROGRAM_ID=your_program_id
FEE_WALLET=your_fee_wallet
TREASURY_WALLET=your_treasury_wallet

# IPFS
PINATA_API_KEY=your_pinata_key
PINATA_SECRET_KEY=your_pinata_secret

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
```

4. **Build and Run**

```bash
# Build the project
mvn clean install

# Run the application
mvn spring-boot:run

# Or run with specific profile
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

The API will be available at `http://localhost:8080/api`

## 📁 Project Structure

```
backend/
├── src/main/java/com/floppfun/
│   ├── config/              # Configuration classes
│   ├── controller/          # REST API endpoints
│   ├── service/             # Business logic
│   ├── repository/          # Data access layer
│   ├── model/
│   │   ├── entity/          # JPA entities
│   │   └── dto/             # Request/Response models
│   ├── security/            # Authentication & authorization
│   ├── websocket/           # WebSocket handlers
│   ├── exception/           # Custom exceptions
│   └── util/                # Utility classes
└── src/main/resources/
    ├── application.yml      # Main configuration
    ├── application-dev.yml  # Dev profile
    └── application-prod.yml # Production profile
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Wallet signature verification
- `POST /api/auth/verify` - Verify JWT token

### Tokens
- `GET /api/tokens` - List all tokens (paginated)
- `GET /api/tokens/{id}` - Get token details
- `POST /api/tokens/create` - Create new token
- `GET /api/tokens/trending` - Get trending tokens
- `GET /api/tokens/search?q=` - Search tokens

### Trading
- `POST /api/trades/buy` - Buy tokens
- `POST /api/trades/sell` - Sell tokens
- `GET /api/trades/history` - User trade history
- `GET /api/trades/token/{id}` - Token trade history

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users/{id}/holdings` - User holdings
- `GET /api/users/{id}/created` - Tokens created by user

### WebSocket
- `/topic/price/{tokenId}` - Subscribe to price updates
- `/topic/trades` - Subscribe to global trades

## 🗄️ Database Schema

The application uses PostgreSQL with JPA/Hibernate for ORM. Tables are auto-created on startup in development mode.

**Main Tables:**
- `users` - User accounts linked to Solana wallets
- `tokens` - SPL tokens with bonding curve data
- `transactions` - Buy/sell transactions
- `user_holdings` - User token holdings
- `token_comments` - Comments on tokens

## 🔒 Security

- **JWT Authentication**: Stateless token-based auth
- **Wallet Signature Verification**: Cryptographic proof of wallet ownership
- **CORS Configuration**: Configurable cross-origin requests
- **Input Validation**: Bean validation on all requests
- **SQL Injection Protection**: JPA parameterized queries

## 🧪 Testing

```bash
# Run all tests
mvn test

# Run with coverage
mvn test jacoco:report
```

## 📦 Build for Production

```bash
# Build JAR file
mvn clean package -DskipTests

# Run the JAR
java -jar target/floppfun-backend-1.0.0.jar --spring.profiles.active=prod
```

## 🐳 Docker Support

```dockerfile
# Build
docker build -t floppfun-backend .

# Run
docker run -p 8080:8080 \
  -e DB_USERNAME=postgres \
  -e DB_PASSWORD=password \
  floppfun-backend
```

## 🚀 Deployment Options

### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### AWS / DigitalOcean / Oracle Cloud
Upload the JAR file and run with:
```bash
java -jar floppfun-backend-1.0.0.jar \
  --spring.profiles.active=prod \
  --server.port=8080
```

## 📊 Monitoring

The application exposes actuator endpoints for monitoring:
- `/actuator/health` - Health check
- `/actuator/metrics` - Application metrics
- `/actuator/info` - Application info

## 🛠️ Development

### Hot Reload
Spring DevTools is included for automatic restart during development.

### Database Migrations
For production, consider using Flyway or Liquibase for database version control.

### Code Style
Follow standard Java conventions and Spring Boot best practices.

## 📝 License

MIT License - see LICENSE file

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📧 Support

For issues and questions, please create an issue in the repository.
