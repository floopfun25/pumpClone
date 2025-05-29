# FloppFun - Meme Token Launchpad

FloppFun is a decentralized meme token launchpad built on Solana blockchain for creating and trading meme tokens with fair launch bonding curves.

## 🚀 Features

- **Token Creation**: Launch your own meme tokens with fair launch mechanics
- **Bonding Curve Trading**: Trade tokens using constant product bonding curves
- **Wallet Integration**: Connect with Phantom, Solflare, and other Solana wallets
- **Real-time Updates**: Live price feeds and trading activity
- **Portfolio Management**: Track your token holdings and performance
- **Social Features**: Comments, likes, and community interaction
- **Dark Mode**: Beautiful dark/light theme support
- **Mobile Responsive**: Optimized for all device sizes

## 🏗️ Architecture

### Frontend (Vue.js)
- **Vue 3** with Composition API
- **TypeScript** for type safety
- **Pinia** for state management
- **Vue Router** for navigation
- **Tailwind CSS** for styling
- **Vite** for fast development

### Backend (Supabase)
- **PostgreSQL** database with real-time subscriptions
- **Row Level Security** for data protection
- **Edge Functions** for serverless logic
- **Storage** for images and metadata
- **Authentication** with wallet-based auth

### Blockchain (Solana)
- **SPL Token Program** for token creation
- **Metaplex** for metadata standards
- **Bonding Curve** mathematics for fair pricing
- **Wallet Adapter** for multiple wallet support

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Docker (optional)

### Local Development

1. **Clone the repository**
```bash
git clone <repository-url>
cd pump-fun-clone
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your Supabase credentials
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_SOLANA_NETWORK=devnet
```

4. **Start development server**
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Docker Deployment

1. **Build and run with Docker Compose**
```bash
docker-compose up --build
```

2. **Or build and run manually**
```bash
# Build the image
docker build -t pump-fun-clone .

# Run the container
docker run -p 3000:80 pump-fun-clone
```

The application will be available at `http://localhost:3000`

## 🗄️ Database Schema

### Core Tables

#### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_volume_traded BIGINT DEFAULT 0,
  tokens_created INTEGER DEFAULT 0
);
```

#### Tokens
```sql
CREATE TABLE tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mint_address TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  creator_id UUID REFERENCES users(id),
  total_supply BIGINT NOT NULL,
  current_price DECIMAL(20,10) DEFAULT 0,
  market_cap BIGINT DEFAULT 0,
  volume_24h BIGINT DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Transactions
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature TEXT UNIQUE NOT NULL,
  token_id UUID REFERENCES tokens(id),
  user_id UUID REFERENCES users(id),
  transaction_type TEXT NOT NULL,
  sol_amount BIGINT NOT NULL,
  token_amount BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔧 Configuration

### Supabase Setup

1. Create a new Supabase project
2. Run the database migrations in `supabase/migrations/`
3. Set up Row Level Security policies
4. Configure authentication settings
5. Set up storage buckets for images

### Solana Configuration

The application is configured for Solana Devnet by default. To use Mainnet:

1. Update `VITE_SOLANA_NETWORK=mainnet-beta`
2. Update `VITE_SOLANA_RPC_URL` to a mainnet RPC endpoint
3. Ensure you have mainnet SOL for transactions

## 🎨 Styling

The project uses Tailwind CSS with custom design tokens:

- **Primary Colors**: Blue gradient theme
- **Pump Colors**: Green for positive, red for negative
- **Dark Mode**: Full dark theme support
- **Responsive**: Mobile-first design approach

## 📱 Components

### Layout Components
- `Navbar.vue` - Main navigation with wallet connection
- `Footer.vue` - Site footer with links
- `Sidebar.vue` - Mobile navigation drawer

### Token Components
- `TokenCard.vue` - Token display card
- `TokenChart.vue` - Price chart visualization
- `TradingInterface.vue` - Buy/sell interface
- `TokenCreator.vue` - Token creation wizard

### Common Components
- `LoadingOverlay.vue` - Global loading states
- `ToastContainer.vue` - Notification system
- `Modal.vue` - Reusable modal dialogs

## 🔄 State Management

The application uses Pinia stores for state management:

- **Auth Store** (`stores/auth.ts`) - User authentication
- **Wallet Store** (`stores/wallet.ts`) - Wallet connection
- **Tokens Store** (`stores/tokens.ts`) - Token data
- **UI Store** (`stores/ui.ts`) - UI state and notifications

## 🚀 Deployment

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker Production

```bash
# Build production image
docker build -t pump-fun-clone:latest .

# Run in production mode
docker run -p 80:80 pump-fun-clone:latest
```

### Environment Variables

For production deployment, set these environment variables:

```bash
VITE_SUPABASE_URL=your_production_supabase_url
VITE_SUPABASE_ANON_KEY=your_production_anon_key
VITE_SOLANA_RPC_URL=your_production_rpc_url
VITE_SOLANA_NETWORK=mainnet-beta
```

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Run linting
npm run lint

# Type checking
npm run type-check
```

## 📈 Performance

- **Lazy Loading**: Components are lazy-loaded for optimal performance
- **Code Splitting**: Automatic code splitting with Vite
- **Image Optimization**: Responsive images with WebP support
- **Caching**: Aggressive caching for static assets
- **CDN**: Global content delivery via Nginx

## 🔒 Security

- **Row Level Security**: Database-level access control
- **Input Validation**: Client and server-side validation
- **XSS Protection**: Content Security Policy headers
- **HTTPS**: SSL/TLS encryption in production
- **Wallet Security**: Non-custodial wallet integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This is an educational project for learning purposes. FloppFun is an independent decentralized platform for meme token creation and trading. Use at your own risk and always do your own research before trading cryptocurrencies.

## 🆘 Support

For support and questions:

- Create an issue on GitHub
- Join our Discord community
- Follow us on Twitter

## 🙏 Acknowledgments

- [pump.fun](https://pump.fun) for the original concept
- [Solana](https://solana.com) for the blockchain infrastructure
- [Supabase](https://supabase.com) for the backend platform
- [Vue.js](https://vuejs.org) for the frontend framework
- [Tailwind CSS](https://tailwindcss.com) for the styling system