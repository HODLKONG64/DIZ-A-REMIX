$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$artifactRoot = Join-Path $repoRoot "desktop\artifacts\swarmsy-desktop-win32-x64"
$artifactBackup = "$artifactRoot.install-smoke-source"
$installerPath = Join-Path $repoRoot "desktop\artifacts\SWARMSY-Desktop-Setup.exe"
$installRoot = Join-Path $env:LOCALAPPDATA "Programs\SWARMSY Desktop"
$installedExe = Join-Path $installRoot "SWARMSY Desktop.exe"
$uninstallerPath = Join-Path $installRoot "Uninstall SWARMSY Desktop.exe"
$installedArchive = Join-Path $installRoot "resources\app\desktop\runtime\server-node-modules.tar.gz"
$installedRuntimeEntrypoint = Join-Path $installRoot "resources\app\desktop\runtime\start-local-runtime.cjs"
$installedServerEntrypoint = Join-Path $installRoot "resources\app\server\index.js"
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

function Write-DirectorySummary {
  param(
    [string]$Label,
    [string]$Root
  )

  Write-Host "--- $Label ---"
  Write-Host "Path: $Root"
  Write-Host "Exists: $(Test-Path -LiteralPath $Root)"
  if (!(Test-Path -LiteralPath $Root)) { return }

  Get-ChildItem -LiteralPath $Root -Recurse -Depth 2 -Force -ErrorAction SilentlyContinue |
    Select-Object FullName, Length, LastWriteTime |
    Format-Table -AutoSize |
    Out-String -Width 240 |
    Write-Host
}

function Write-InstalledRuntimeDiagnostics {
  param(
    [string]$InstallRoot
  )

  $runtimeRoot = Join-Path $InstallRoot "resources\app\desktop\runtime"
  $serverRoot = Join-Path $InstallRoot "resources\app\server"
  $temporarySmokeRoots = Join-Path ([System.IO.Path]::GetTempPath()) "swarmsy-desktop-launch-smoke-*"

  Write-Host "=== Installed SWARMSY Runtime Diagnostics ==="
  Write-Host "InstallRoot: $InstallRoot"
  Write-Host "Installed EXE exists: $(Test-Path -LiteralPath $installedExe)"
  Write-Host "Runtime entrypoint exists: $(Test-Path -LiteralPath $installedRuntimeEntrypoint)"
  Write-Host "Server entrypoint exists: $(Test-Path -LiteralPath $installedServerEntrypoint)"
  Write-Host "Dependency archive exists: $(Test-Path -LiteralPath $installedArchive)"
  Write-Host "Raw server node_modules exists: $(Test-Path -LiteralPath $installedNodeModules)"

  Write-DirectorySummary -Label "installed runtime tree (depth 2)" -Root $runtimeRoot
  Write-DirectorySummary -Label "installed server tree (depth 2)" -Root $serverRoot
  Write-DirectorySummary -Label "runtime dependency cache (depth 2)" -Root $smokeCacheRoot

  Write-Host "--- recent smoke data and logs ---"
  Get-ChildItem -Path $temporarySmokeRoots -Directory -Force -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 5 |
    ForEach-Object {
      Write-Host "Smoke root: $($_.FullName)"
      Get-ChildItem -LiteralPath $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 30 FullName, LastWriteTime, Length |
        Format-Table -AutoSize |
        Out-String -Width 240 |
        Write-Host
    }

  Write-Host "--- SWARMSY processes ---"
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -like "*SWARMSY*" -or
      $_.CommandLine -like "*start-local-runtime*" -or
      $_.CommandLine -like "*desktop-runtime-launch-smoke*"
    } |
    Select-Object ProcessId, ParentProcessId, Name, ExecutablePath, CommandLine |
    Format-List |
    Out-String -Width 240 |
    Write-Host

  Write-Host "=== End Installed SWARMSY Runtime Diagnostics ==="
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
  if (!(Test-Path -LiteralPath $installedRuntimeEntrypoint)) {
    throw "Installed runtime entrypoint is missing: $installedRuntimeEntrypoint"
  }
  if (!(Test-Path -LiteralPath $installedServerEntrypoint)) {
    throw "Installed server entrypoint is missing: $installedServerEntrypoint"
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
    $env:SWARMSY_DESKTOP_PACKAGED_RUNTIME_START_TIMEOUT_MS = "600000"
    $env:SWARMSY_RUNTIME_SMOKE_TIMEOUT_MS = "900000"
    $env:SWARMSY_RUNTIME_SMOKE_RETRY_MS = "1000"

    # Force the smoke test to target installed app/runtime paths directly.
    $env:SWARMSY_DESKTOP_ROOT_OVERRIDE = $installRoot
    $env:SWARMSY_RUNTIME_BASE_OVERRIDE = Join-Path $installRoot "resources\app\desktop\runtime"
    $env:SWARMSY_SERVER_ROOT_OVERRIDE = Join-Path $installRoot "resources\app\server"

    npm run desktop:runtime:smoke:win
    if ($LASTEXITCODE -ne 0) {
      Write-InstalledRuntimeDiagnostics -InstallRoot $installRoot
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
