$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$artifactRoot = Join-Path $repoRoot "desktop\artifacts\swarmsy-desktop-win32-x64"
$artifactBackup = "$artifactRoot.install-smoke-source"
$installerPath = Join-Path $repoRoot "desktop\artifacts\SWARMSY-Desktop-Setup.exe"
$installRoot = Join-Path $env:LOCALAPPDATA "Programs\SWARMSY Desktop"
$installedExe = Join-Path $installRoot "SWARMSY Desktop.exe"
$uninstallerPath = Join-Path $installRoot "Uninstall SWARMSY Desktop.exe"
$installedArchive = Join-Path $installRoot "resources\app\desktop\runtime\server-node-modules.tar.gz"
$installedNodeModules = Join-Path $installRoot "resources\app\server\node_modules"
$smokeCacheRoot = Join-Path $env:LOCALAPPDATA "SWY"

function Stop-SwarmsyProcesses {
  Get-Process -Name "SWARMSY Desktop" -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
}

function Remove-JunctionIfPresent([string]$junctionPath) {
  if (!(Test-Path -LiteralPath $junctionPath)) { return }
  cmd.exe /d /c "rmdir `"$junctionPath`"" | Out-Null
  if ($LASTEXITCODE -ne 0 -and (Test-Path -LiteralPath $junctionPath)) {
    throw "Failed to remove temporary artifact junction: $junctionPath"
  }
}

function Uninstall-Swarmsy {
  Stop-SwarmsyProcesses
  if (Test-Path -LiteralPath $uninstallerPath) {
    $uninstall = Start-Process -FilePath $uninstallerPath -ArgumentList "/S" -PassThru -Wait
    if ($uninstall.ExitCode -ne 0) {
      throw "SWARMSY uninstaller exited with $($uninstall.ExitCode)."
    }
  }
  if (Test-Path -LiteralPath $installRoot) {
    Remove-Item -LiteralPath $installRoot -Recurse -Force
  }
}

if (!(Test-Path -LiteralPath $installerPath)) {
  throw "Installer is missing: $installerPath"
}
if (!(Test-Path -LiteralPath $artifactRoot)) {
  throw "Packaged artifact is missing: $artifactRoot"
}

try {
  Uninstall-Swarmsy

  $install = Start-Process -FilePath $installerPath -ArgumentList "/S" -PassThru -Wait
  if ($install.ExitCode -ne 0) {
    throw "SWARMSY installer exited with $($install.ExitCode)."
  }
  if (!(Test-Path -LiteralPath $installedExe)) {
    throw "Installed desktop executable is missing: $installedExe"
  }
  if (!(Test-Path -LiteralPath $installedArchive)) {
    throw "Installed runtime dependency archive is missing: $installedArchive"
  }
  if (Test-Path -LiteralPath $installedNodeModules) {
    throw "Installer wrote raw server/node_modules instead of the archived runtime payload: $installedNodeModules"
  }

  if (Test-Path -LiteralPath $artifactBackup) {
    Remove-Item -LiteralPath $artifactBackup -Recurse -Force
  }
  Move-Item -LiteralPath $artifactRoot -Destination $artifactBackup
  New-Item -ItemType Junction -Path $artifactRoot -Target $installRoot | Out-Null

  Push-Location $repoRoot
  try {
    npm run desktop:runtime:smoke:win
    if ($LASTEXITCODE -ne 0) {
      throw "Installed SWARMSY runtime smoke failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }

  Write-Host "[desktop:installer:installed-smoke] Silent install, installed EXE launch, runtime startup, and dependency extraction passed."
} finally {
  Stop-SwarmsyProcesses
  Remove-JunctionIfPresent $artifactRoot
  if (Test-Path -LiteralPath $artifactBackup) {
    Move-Item -LiteralPath $artifactBackup -Destination $artifactRoot
  }
  Uninstall-Swarmsy
  if (Test-Path -LiteralPath $smokeCacheRoot) {
    Remove-Item -LiteralPath $smokeCacheRoot -Recurse -Force
  }
}
