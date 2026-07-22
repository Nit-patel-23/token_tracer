# Token Tracer — One-Line Windows Background Sync Installer
# Usage:
#   $ApiKey="av_live_YOUR_KEY"; iex (irm https://token-tracer-three.vercel.app/install.ps1)

if (-not $ApiKey) { $ApiKey = $key }
if (-not $ApiKey) { $ApiKey = $env:TOKEN_TRACER_KEY }

if (-not $ApiKey) {
    Write-Error "❌ Error: Missing `$ApiKey variable."
    Write-Host "Please run it like this:"
    Write-Host "`$ApiKey='av_live_YOUR_KEY'; iex (irm https://token-tracer-three.vercel.app/install.ps1)"
    exit 1
}

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "❌ Error: Node.js is not installed on this PC."
    Write-Host "Please install Node.js (v18+) from https://nodejs.org and try again."
    exit 1
}

$ServerUrl = "https://token-tracer-three.vercel.app"
$TargetDir = Join-Path $env:USERPROFILE ".token-tracer"
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

Write-Host "📦 Installing Token Tracer background sync agent in $TargetDir..."

# Save config.json
$ConfigPath = Join-Path $TargetDir "config.json"
$ConfigJson = @{
    apiUrl = $ServerUrl
    apiKey = $ApiKey
    intervalMin = 10
} | ConvertTo-Json
Set-Content -Path $ConfigPath -Value $ConfigJson -Force

# Download background sync daemon
Write-Host "⬇️ Downloading background sync daemon..."
$DaemonPath = Join-Path $TargetDir "sync-daemon.mjs"
Invoke-RestMethod -Uri "$ServerUrl/sync-daemon.mjs" -OutFile $DaemonPath

# Create run-daemon.vbs launcher to run node in the background hidden
$VbsPath = Join-Path $TargetDir "run-daemon.vbs"
$VbsContent = @"
CreateObject("Wscript.Shell").Run "node `"$DaemonPath`" --config `"$ConfigPath`" --state `"$TargetDir\sync-state.json`" --log `"$TargetDir\sync.log`"", 0, False
"@
Set-Content -Path $VbsPath -Value $VbsContent -Force

# Register in Windows Startup folder for automatic execution at login
$StartupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
$ShortcutPath = Join-Path $StartupFolder "TokenTracer.lnk"

# Create Shortcut using Wscript.Shell COM object
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$VbsPath`""
$Shortcut.WindowStyle = 7 # Minimized/Hidden
$Shortcut.Description = "Token Tracer Background Sync Agent"
$Shortcut.Save()

# Kill any existing background node processes for sync-daemon to avoid conflicts
Write-Host "🔄 Starting background sync agent..."
Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like "*sync-daemon.mjs*" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# Start the daemon in the background
Start-Process "wscript.exe" -ArgumentList "`"$VbsPath`"" -WindowStyle Hidden

Write-Host ""
Write-Host "=========================================================="
Write-Host "  ✅ Token Tracer background sync agent successfully installed!"
Write-Host "  🔄 Background daemon active: syncing every 10 minutes."
Write-Host "  📁 Config location: $ConfigPath"
Write-Host "  📜 Log file location: $TargetDir\sync.log"
Write-Host "=========================================================="
