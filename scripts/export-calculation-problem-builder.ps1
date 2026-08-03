[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Destination
)

Set-StrictMode -Version Latest
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$sourceApp = Join-Path $sourceRoot "apps\custom-calculation-problem-builder"
$sharedPrintScript = Join-Path $sourceRoot "apps\shared\print-adjustments.js"
$manualPdf = Join-Path $sourceRoot "docs\manuals\calculation-problem-builder-guide.pdf"
$destinationRoot = [IO.Path]::GetFullPath($Destination)

if ($destinationRoot.TrimEnd("\") -eq $sourceRoot.TrimEnd("\") -or
    $destinationRoot.StartsWith($sourceRoot.TrimEnd("\") + "\", [StringComparison]::OrdinalIgnoreCase)) {
  throw "出力先は元リポジトリの外側を指定してください: $destinationRoot"
}

$sourceFiles = @(
  "index.html",
  "app.js",
  "styles.css",
  "release-check.js",
  "release.json",
  "README.md"
)

foreach ($fileName in $sourceFiles) {
  $sourcePath = Join-Path $sourceApp $fileName
  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "コピー元ファイルが見つかりません: $sourcePath"
  }
}

foreach ($requiredPath in @($sharedPrintScript, $manualPdf)) {
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "独立版に必要なファイルが見つかりません: $requiredPath"
  }
}

New-Item -ItemType Directory -Path $destinationRoot -Force | Out-Null

foreach ($fileName in $sourceFiles) {
  Copy-Item -LiteralPath (Join-Path $sourceApp $fileName) -Destination (Join-Path $destinationRoot $fileName) -Force
}

Copy-Item -LiteralPath $sharedPrintScript -Destination (Join-Path $destinationRoot "print-adjustments.js") -Force
Copy-Item -LiteralPath $manualPdf -Destination (Join-Path $destinationRoot "guide.pdf") -Force

$indexPath = Join-Path $destinationRoot "index.html"
$indexText = [IO.File]::ReadAllText($indexPath)
$homeLink = '<a class="home-link" href="../../index.html">入口に戻る</a>'
$standaloneLink = '<a class="home-link" href="guide.pdf" target="_blank" rel="noopener">使い方</a>'
if (-not $indexText.Contains($homeLink)) {
  throw "入口リンクの変換対象が見つかりません: $indexPath"
}
$indexText = $indexText.Replace($homeLink, $standaloneLink)

$sharedScriptPattern = '<script src="\.\./shared/print-adjustments\.js([^"]*)"></script>'
if (-not [Regex]::IsMatch($indexText, $sharedScriptPattern)) {
  throw "共通印刷スクリプトの変換対象が見つかりません: $indexPath"
}
$indexText = [Regex]::Replace($indexText, $sharedScriptPattern, '<script src="print-adjustments.js$1"></script>')
[IO.File]::WriteAllText($indexPath, $indexText, [Text.UTF8Encoding]::new($false))

$appPath = Join-Path $destinationRoot "app.js"
$appText = [IO.File]::ReadAllText($appPath)
$stateKeyPattern = 'const stateStorageKey = "[^"]+";'
if ([Regex]::Matches($appText, $stateKeyPattern).Count -ne 1) {
  throw "保存キーの変換対象が一意に見つかりません: $appPath"
}
$appText = [Regex]::Replace($appText, $stateKeyPattern, 'const stateStorageKey = "calculation-problem-builder-public-state-v1";')
[IO.File]::WriteAllText($appPath, $appText, [Text.UTF8Encoding]::new($false))

[IO.File]::WriteAllText((Join-Path $destinationRoot ".nojekyll"), "", [Text.UTF8Encoding]::new($false))
Write-Output "独立版を書き出しました: $destinationRoot"
