#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$engineRoot = 'C:\ProgramData\cocos\editors\Creator\3.8.7\resources\resources\3d\engine'
$engineBin = Join-Path $engineRoot 'bin'
$programCache = Join-Path $engineBin '.cache'
$writableCache = 'D:\jjfbol-cocos\cocos-engine-cache'
$dashboardBin = 'D:\Program Files (x86)\CocosDashboard\bin'
$dashboardCache = Join-Path $dashboardBin '.cache'
$oldRoot = 'F:\\editor_3d\\v3.8.7\\resources\\3d\\engine'
$oldRootEngine = 'C:\\ProgramData\\cocos\\editors\\Creator\\3.8.7\\resources\\resources\\3d\\engine'
$writableCacheEscaped = 'D:\\jjfbol-cocos\\cocos-engine-cache'
$logFile = 'D:\jjfbol-cocos\jjfbol-cocos\jjfb\temp\cocos_fix.log'

function Write-Log([string]$Message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Write-Host $line
    Add-Content -LiteralPath $logFile -Value $line
}

Write-Log '=== Cocos Creator 3.8.7 cache repair ==='

Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -match 'Cocos|cocos' } |
    ForEach-Object {
        Write-Log "Stopping $($_.ProcessName) (PID $($_.Id))"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
Start-Sleep -Seconds 2

if (-not (Test-Path -LiteralPath $writableCache)) {
    New-Item -ItemType Directory -Path $writableCache -Force | Out-Null
}

if (Test-Path -LiteralPath $programCache) {
  $item = Get-Item -LiteralPath $programCache -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    Write-Log "Removing existing program cache junction: $programCache"
    cmd /c rmdir `"$programCache`" | Out-Null
  } else {
    Write-Log "Syncing program cache into writable cache: $writableCache"
    robocopy $programCache $writableCache /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    Write-Log "Removing stale program cache: $programCache"
    Remove-Item -LiteralPath $programCache -Recurse -Force
  }
}

Write-Log 'Patching stale F: drive paths in writable cache'
Get-ChildItem -Path $writableCache -Recurse -File -Include *.json,*.js | ForEach-Object {
  $text = [IO.File]::ReadAllText($_.FullName)
  $new = $text.Replace($oldRoot, $oldRootEngine).Replace("$oldRoot\\bin\\.cache", $writableCacheEscaped).Replace("$oldRootEngine\\bin\\.cache", $writableCacheEscaped)
  if ($new -ne $text) {
    [IO.File]::WriteAllText($_.FullName, $new)
  }
}

Write-Log "Creating program cache junction: $programCache -> $writableCache"
cmd /c mklink /J `"$programCache`" `"$writableCache`" | Out-Null

if (-not (Test-Path -LiteralPath $dashboardBin)) {
  New-Item -ItemType Directory -Path $dashboardBin -Force | Out-Null
}
if (Test-Path -LiteralPath $dashboardCache) {
  $item = Get-Item -LiteralPath $dashboardCache -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    cmd /c rmdir `"$dashboardCache`" | Out-Null
  } else {
    Remove-Item -LiteralPath $dashboardCache -Recurse -Force
  }
}
Write-Log "Creating dashboard cache junction: $dashboardCache -> $writableCache"
cmd /c mklink /J `"$dashboardCache`" `"$writableCache`" | Out-Null

Write-Log 'Granting Users modify permission on writable cache'
icacls $writableCache /grant 'Users:(OI)(CI)M' /T | Out-Null

$testFile = Join-Path $writableCache 'dev\editor\import-map.json'
if (Test-Path -LiteralPath $testFile) {
  try {
    Add-Content -LiteralPath $testFile -Value '' -ErrorAction Stop
    Write-Log 'Write test passed on import-map.json'
  } catch {
    Write-Log "Write test failed: $($_.Exception.Message)"
  }
}

Write-Log 'Repair complete. Restart Cocos Creator and open jjfb project.'
