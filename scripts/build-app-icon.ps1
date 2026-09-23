$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$costumeRoot = Join-Path $projectRoot 'assets\isaac\gfx\characters\costumes'
$outputRoot = Join-Path $projectRoot 'build'
$pngPath = Join-Path $outputRoot 'app-icon.png'
$icoPath = Join-Path $outputRoot 'app-icon.ico'

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

function New-PixelBitmap([System.Drawing.Image]$source, [int]$size) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size,
    ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $graphics.DrawImage(
      $source,
      (New-Object System.Drawing.Rectangle 0, 0, $size, $size),
      0,
      0,
      $source.Width,
      $source.Height,
      [System.Drawing.GraphicsUnit]::Pixel
    )
  } finally {
    $graphics.Dispose()
  }
  return $bitmap
}

$isaac = [System.Drawing.Image]::FromFile((Join-Path $costumeRoot 'character_001_isaac.png'))
$venus = [System.Drawing.Image]::FromFile((Join-Path $costumeRoot 'costume_038x_venus.png'))
$stage = New-Object System.Drawing.Bitmap 80, 88,
  ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stageGraphics = [System.Drawing.Graphics]::FromImage($stage)

try {
  $stageGraphics.Clear([System.Drawing.Color]::Transparent)
  $stageGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $stageGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
  $stageGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $stageGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $stageGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None

  # Venus back, Isaac WalkDown/HeadDown frame 0, then Venus head and hair.
  $stageGraphics.DrawImage($venus, (New-Object System.Drawing.Rectangle 8, 17, 64, 64), 0, 128, 64, 64, [System.Drawing.GraphicsUnit]::Pixel)
  $stageGraphics.DrawImage($isaac, (New-Object System.Drawing.Rectangle 24, 43, 32, 32), 0, 32, 32, 32, [System.Drawing.GraphicsUnit]::Pixel)
  $stageGraphics.DrawImage($isaac, (New-Object System.Drawing.Rectangle 24, 33, 32, 32), 0, 0, 32, 32, [System.Drawing.GraphicsUnit]::Pixel)
  $stageGraphics.DrawImage($venus, (New-Object System.Drawing.Rectangle 24, 33, 32, 32), 128, 128, 32, 32, [System.Drawing.GraphicsUnit]::Pixel)
  $stageGraphics.DrawImage($venus, (New-Object System.Drawing.Rectangle 8, 17, 64, 64), 0, 0, 64, 64, [System.Drawing.GraphicsUnit]::Pixel)

  $logicalIcon = $stage.Clone(
    (New-Object System.Drawing.Rectangle 8, 17, 64, 64),
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  try {
    $pngIcon = New-PixelBitmap $logicalIcon 256
    try {
      $pngIcon.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $pngIcon.Dispose()
    }

    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $images = New-Object System.Collections.Generic.List[byte[]]
    foreach ($size in $sizes) {
      $bitmap = New-PixelBitmap $logicalIcon $size
      $stream = New-Object IO.MemoryStream
      try {
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        $images.Add($stream.ToArray())
      } finally {
        $stream.Dispose()
        $bitmap.Dispose()
      }
    }

    $file = [IO.File]::Open($icoPath, [IO.FileMode]::Create, [IO.FileAccess]::Write)
    $writer = New-Object IO.BinaryWriter $file
    try {
      $writer.Write([uint16]0)
      $writer.Write([uint16]1)
      $writer.Write([uint16]$sizes.Count)
      $offset = 6 + 16 * $sizes.Count
      for ($index = 0; $index -lt $sizes.Count; $index += 1) {
        $size = $sizes[$index]
        $bytes = $images[$index]
        $writer.Write([byte]$(if ($size -eq 256) { 0 } else { $size }))
        $writer.Write([byte]$(if ($size -eq 256) { 0 } else { $size }))
        $writer.Write([byte]0)
        $writer.Write([byte]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]32)
        $writer.Write([uint32]$bytes.Length)
        $writer.Write([uint32]$offset)
        $offset += $bytes.Length
      }
      foreach ($bytes in $images) {
        $writer.Write($bytes)
      }
    } finally {
      $writer.Dispose()
      $file.Dispose()
    }
  } finally {
    $logicalIcon.Dispose()
  }
} finally {
  $stageGraphics.Dispose()
  $stage.Dispose()
  $venus.Dispose()
  $isaac.Dispose()
}

Write-Output "Generated $pngPath and $icoPath"
