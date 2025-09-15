Write-Host "Testing Solana installation methods..." -ForegroundColor Yellow

# Method 1: Try direct GitHub download
Write-Host "Method 1: Downloading from GitHub..." -ForegroundColor Cyan
try {
    $url = "https://github.com/anza-xyz/agave/releases/download/v2.3.8/solana-install-init-x86_64-pc-windows-msvc.exe"
    $output = "$env:TEMP\solana-installer.exe"
    Write-Host "Downloading to: $output" -ForegroundColor White
    
    Invoke-WebRequest -Uri $url -OutFile $output -TimeoutSec 60 -UseBasicParsing
    
    if (Test-Path $output) {
        Write-Host "✓ Download successful!" -ForegroundColor Green
        Write-Host "File size: $((Get-Item $output).Length) bytes" -ForegroundColor White
        Write-Host "You can now run: $output" -ForegroundColor White
    } else {
        Write-Host "❌ Download failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ GitHub download failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nAlternative methods:" -ForegroundColor Yellow
Write-Host "1. Use WSL (Windows Subsystem for Linux)" -ForegroundColor White
Write-Host "2. Use Docker for deployment" -ForegroundColor White
Write-Host "3. Use GitHub Codespaces or online IDE" -ForegroundColor White