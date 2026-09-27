# Lokalny serwer podglądu (bez Node/Pythona): powershell -File tools/serve.ps1 [-Port 5180]
param([int]$Port = 5180)
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'; '.png' = 'image/png'
  '.svg' = 'image/svg+xml'; '.xlsx' = 'application/octet-stream'; '.ico' = 'image/x-icon'
}
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Podglad: http://localhost:$Port/"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
  if ($path -eq '/') { $path = '/index.html' }
  $file = [IO.Path]::GetFullPath((Join-Path $root $path.TrimStart('/')))
  $res = $ctx.Response
  $res.Headers.Add('Cache-Control', 'no-store')
  if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $type = $mime[[IO.Path]::GetExtension($file)]
    if (-not $type) { $type = 'application/octet-stream' }
    $res.ContentType = $type
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $res.StatusCode = 404
  }
  $res.Close()
}
