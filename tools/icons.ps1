# Generuje ikony PNG aplikacji (sztanga na ciemnym tle) przez System.Drawing.
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\icons'

function Draw-Icon([int]$size, [string]$file, [double]$pad) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::FromArgb(255, 14, 14, 16))
  $accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 107, 44))
  $light = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 244, 242, 238))
  $s = $size * (1 - 2 * $pad) / 100.0
  $o = $size * $pad
  function Add-Bar($x, $y, $w, $h, $b) { $g.FillRectangle($b, [float]($o + $x * $s), [float]($o + $y * $s), [float]($w * $s), [float]($h * $s)) }
  Add-Bar 8 46 84 8 $light
  Add-Bar 14 28 10 44 $accent
  Add-Bar 26 20 10 60 $accent
  Add-Bar 64 20 10 60 $accent
  Add-Bar 76 28 10 44 $accent
  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

Draw-Icon 192 'icon-192.png' 0.12
Draw-Icon 512 'icon-512.png' 0.12
Draw-Icon 512 'icon-maskable-512.png' 0.22
