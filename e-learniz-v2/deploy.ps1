param([string]$ver = (Get-Date -Format 'yyyyMMdd'))

$htmlFiles = Get-ChildItem -Recurse -Filter *.html | Where-Object { $_.FullName -notmatch '\\node_modules\\' }

foreach ($f in $htmlFiles) {
    $content = Get-Content -LiteralPath $f.FullName -Raw

    # Update versi lama kalo udah ada
    $content = $content -replace '\.(js|css)\?v=\d+(")', ".`$1?v=$ver`$2"

    # Tambahin versi ke local JS yg belum pake versi (skip external/CDN)
    $content = $content -replace '(src="(?:\.\./|/)[^"]+\.js)(?!\?v=)(")', "`$1?v=$ver`$2"
    $content = $content -replace '(href="(?:\.\./|/)[^"]+\.css)(?!\?v=)(")', "`$1?v=$ver`$2"

    Set-Content -LiteralPath $f.FullName -Value $content -NoNewline
}

Write-Host "Deploy v$ver - cache-bust selesai"
