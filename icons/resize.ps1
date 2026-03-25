Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('d:\projects\testing\2026\requestly\icons\app128.png')
$sizes = @(16, 32, 48)
foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gfx.DrawImage($img, 0, 0, $s, $s)
    $outPath = 'd:\projects\testing\2026\requestly\icons\app' + $s + '.png'
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $gfx.Dispose()
    $bmp.Dispose()
}
$img.Dispose()
