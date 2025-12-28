#!/bin/bash

# Complete Anchor setup
export PATH="$HOME/.cargo/bin:$PATH"

echo "📦 Installing Anchor 0.30.1..."
echo "y" | $HOME/.cargo/bin/avm install 0.30.1

echo ""
echo "🔧 Setting Anchor 0.30.1 as active version..."
$HOME/.cargo/bin/avm use 0.30.1

echo ""
echo "✅ Anchor setup complete!"
echo ""
$HOME/.cargo/bin/anchor --version
echo ""
echo "📝 Next steps:"
echo "1. Reload your shell: source ~/.zshrc"
echo "2. Build the program: anchor build"
echo "3. Deploy to devnet: anchor deploy --provider.cluster devnet"
