# Windows Production Deployment Setup
# PowerShell script for setting up Solana development on Windows

Write-Host "🚀 Setting up Solana Development on Windows..." -ForegroundColor Yellow

# Function to check if command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Host "✓ Node.js is installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js not found. Please install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check Rust
Write-Host "Checking Rust..." -ForegroundColor Yellow
$RUST_INSTALLED = $false
if (Test-Command "rustc") {
    $rustVersion = rustc --version
    Write-Host "✓ Rust is installed: $rustVersion" -ForegroundColor Green
    $RUST_INSTALLED = $true
} else {
    Write-Host "❌ Rust not found in PATH" -ForegroundColor Red
    Write-Host "Trying to find Rust in common locations..." -ForegroundColor Yellow
    
    $rustPaths = @(
        "$env:USERPROFILE\.cargo\bin\rustc.exe",
        "$env:LOCALAPPDATA\Programs\Rust\bin\rustc.exe",
        "C:\Program Files\Rust\bin\rustc.exe"
    )
    
    $foundRust = $false
    foreach ($path in $rustPaths) {
        if (Test-Path $path) {
            Write-Host "Found Rust at: $path" -ForegroundColor Green
            $rustDir = Split-Path $path -Parent
            $env:PATH = "$rustDir;$env:PATH"
            $RUST_INSTALLED = $true
            $foundRust = $true
            break
        }
    }
    
    if (!$foundRust) {
        Write-Host "Please install Rust from: https://rustup.rs/" -ForegroundColor Red
        Write-Host "Or ensure it's in your PATH" -ForegroundColor Yellow
        exit 1
    }
}

# Try to install Solana CLI using alternative methods
Write-Host "Installing Solana CLI..." -ForegroundColor Yellow

# Method 1: Try the official installer
$solanaTempPath = "$env:TEMP\solana-install.exe"
try {
    Write-Host "Trying official Solana installer..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://github.com/anza-xyz/agave/releases/download/v2.3.8/solana-install-init-x86_64-pc-windows-msvc.exe" -OutFile $solanaTempPath -TimeoutSec 30
    
    if (Test-Path $solanaTempPath) {
        Write-Host "Running Solana installer..." -ForegroundColor Yellow
        Start-Process -FilePath $solanaTempPath -ArgumentList "v2.3.8" -Wait
        
        # Add Solana to PATH for this session
        $solanaPath = "$env:USERPROFILE\.local\share\solana\install\active_release\bin"
        if (Test-Path $solanaPath) {
            $env:PATH = "$solanaPath;$env:PATH"
            Write-Host "✓ Solana CLI installed successfully" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "Official installer failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Method 2: Try building from source if Rust is available
if (!(Test-Command "solana") -and $RUST_INSTALLED) {
    Write-Host "Trying to install Solana CLI from source..." -ForegroundColor Yellow
    try {
        & cargo install solana-cli --features=default
        Write-Host "✓ Solana CLI installed from source" -ForegroundColor Green
    } catch {
        Write-Host "Failed to install from source: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Check final installation
if (Test-Command "solana") {
    $solanaVersion = solana --version
    Write-Host "✓ Solana CLI ready: $solanaVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Solana CLI installation failed" -ForegroundColor Red
    Write-Host "Manual Installation Options:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://github.com/anza-xyz/agave/releases" -ForegroundColor White
    Write-Host "2. Use WSL (Windows Subsystem for Linux)" -ForegroundColor White
    Write-Host "3. Use Docker-based deployment" -ForegroundColor White
    exit 1
}

# Install Anchor CLI
Write-Host "Installing Anchor CLI..." -ForegroundColor Yellow
if (!(Test-Command "anchor")) {
    try {
        & cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked
        Write-Host "✓ Anchor CLI installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Anchor CLI installation failed" -ForegroundColor Red
        Write-Host "You may need to install manually or use alternative build methods" -ForegroundColor Yellow
    }
} else {
    $anchorVersion = anchor --version
    Write-Host "✓ Anchor CLI ready: $anchorVersion" -ForegroundColor Green
}

Write-Host "🎉 Windows setup complete!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart PowerShell to refresh PATH" -ForegroundColor White
Write-Host "2. Run: .\deploy\configure.sh" -ForegroundColor White
Write-Host "3. Run: .\deploy\build.sh" -ForegroundColor White