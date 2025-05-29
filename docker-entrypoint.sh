#!/bin/sh

# Docker entrypoint script for pump.fun clone
# This script allows runtime environment variable configuration

# Set default values if environment variables are not provided
VITE_SUPABASE_URL=${VITE_SUPABASE_URL:-"https://mlczuanztnqcngioayas.supabase.co"}
VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY:-"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sY3p1YW56dG5xY25naW9heWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3NzIwOTYsImV4cCI6MjA2MjM0ODA5Nn0.ShPAiWshDqZD0pAP9RMGdpfrpBtoGd58r_agzigReeI"}
VITE_SOLANA_RPC_URL=${VITE_SOLANA_RPC_URL:-"https://api.devnet.solana.com"}
VITE_SOLANA_NETWORK=${VITE_SOLANA_NETWORK:-"devnet"}
VITE_APP_NAME=${VITE_APP_NAME:-"Pump.fun Clone"}
VITE_APP_VERSION=${VITE_APP_VERSION:-"1.0.0"}

# Create runtime configuration file
cat > /usr/share/nginx/html/config.js << EOF
// Runtime configuration for pump.fun clone
window.__APP_CONFIG__ = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL}",
  VITE_SUPABASE_ANON_KEY: "${VITE_SUPABASE_ANON_KEY}",
  VITE_SOLANA_RPC_URL: "${VITE_SOLANA_RPC_URL}",
  VITE_SOLANA_NETWORK: "${VITE_SOLANA_NETWORK}",
  VITE_APP_NAME: "${VITE_APP_NAME}",
  VITE_APP_VERSION: "${VITE_APP_VERSION}"
};
EOF

# Inject the configuration script into index.html
# This allows runtime configuration without rebuilding the container
if [ -f /usr/share/nginx/html/index.html ]; then
  sed -i 's|</head>|  <script src="/config.js"></script>\n  </head>|g' /usr/share/nginx/html/index.html
fi

echo "Environment configuration injected successfully"
echo "Supabase URL: ${VITE_SUPABASE_URL}"
echo "Solana Network: ${VITE_SOLANA_NETWORK}"
echo "App Version: ${VITE_APP_VERSION}"

# Execute the main command (start nginx)
exec "$@" 