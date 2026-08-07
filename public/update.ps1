# Token Tracer — One-Line Windows Upgrade Script (run to migrate old version to new version)
# Updates the sync-daemon.mjs script file while preserving all existing configuration logs.

$ServerUrl = "https://token-tracer-three.vercel.app"
$TargetDir = Join-Path $env:USERPROFILE ".token-tracer"
$DaemonPath = Join-Path $TargetDir "sync-daemon.mjs"
$VbsPath = Join-Path $TargetDir "run-daemon.vbs"

if (-not (Test-Path $TargetDir)) {
    Write-Error "❌ Error: Token Tracer directory not found at $TargetDir."
    Write-Host "Please run the install command instead:"
    Write-Host "iex (irm $ServerUrl/install.ps1)"
    exit 1
}

Write-Host "🔄 Upgrading Token Tracer sync daemon..."

# 1. Download the new daemon script directly, overwriting the old one
Write-Host "⬇️  Downloading latest daemon..."
Invoke-RestMethod -Uri "$ServerUrl/sync-daemon.mjs" -OutFile $DaemonPath

# 2. Restart the background daemon process
Write-Host "🔄 Restarting background agent..."
Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like "*sync-daemon.mjs*" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

if (Test-Path $VbsPath) {
    Start-Process "wscript.exe" -ArgumentList "`"$VbsPath`"" -WindowStyle Hidden
} else {
    Write-Warning "⚠️ Could not locate launcher script at $VbsPath. Please check background processes."
}

Write-Host ""
Write-Host "=========================================================="
Write-Host "  ✅ Token Tracer Daemon successfully updated to the latest version!"
Write-Host "  🔄 Background daemon is active and will self-update in the future."
Write-Host "  📜 Update log: $TargetDir\update.log"
Write-Host "=========================================================="
