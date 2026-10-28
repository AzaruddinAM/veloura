<?php

namespace App\Support;

use App\Models\Product;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Turns any uploaded photo (jpg/png/webp/avif/gif) into a set of small,
 * square WebP files using PHP's built-in GD extension (free, no services).
 *
 * The storefront shows product photos in square boxes with object-fit: cover,
 * so we pre-crop to the same centred square: the picture looks identical but
 * the browser downloads far fewer bytes. The bag thumbnail (64px) gets its own
 * 160px file instead of the full photo.
 *
 * Files are written to public/media/products/{content-hash}/{size}.webp. The
 * hash changes whenever the photo changes, so the web server can tell browsers
 * to cache these files forever (see public/.htaccess).
 */
class ProductImage
{
    /** Square edge lengths in px. Covers a 64px bag thumb up to a full-width card on a 3x phone. */
    public const SIZES = [160, 320, 480, 640, 960];

    public const QUALITY = 80;

    /**
     * @return array{key: string, sizes: list<int>}
     */
    public function store(string $path): array
    {
        $bytes = @file_get_contents($path);
        $src = $bytes === false ? false : @imagecreatefromstring($bytes);
        if ($src === false) {
            throw new RuntimeException('The file is not a readable image.');
        }

        $w = imagesx($src);
        $h = imagesy($src);
        $side = min($w, $h);
        $x = intdiv($w - $side, 2);
        $y = intdiv($h - $side, 2);

        // Never upscale: keep the sizes the source can fill, plus the source's own
        // edge when it is meaningfully bigger than the largest of those.
        $sizes = array_values(array_filter(self::SIZES, fn ($s) => $s <= $side));
        if ($side < max(self::SIZES) && (! $sizes || $side > end($sizes) * 1.1)) {
            $sizes[] = $side;
        }

        $key = substr(sha1($bytes), 0, 20);
        $disk = Storage::disk('media');

        foreach ($sizes as $size) {
            $dst = imagecreatetruecolor($size, $size);
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            imagecopyresampled($dst, $src, 0, 0, $x, $y, $size, $size, $side, $side);

            ob_start();
            imagewebp($dst, null, self::QUALITY);
            $disk->put("products/{$key}/{$size}.webp", ob_get_clean());
            imagedestroy($dst);
        }
        imagedestroy($src);

        return ['key' => $key, 'sizes' => $sizes];
    }

    /** Remove an image folder once no product points at it any more. */
    public function deleteIfUnused(?string $key): void
    {
        if ($key && ! Product::where('image_key', $key)->exists()) {
            Storage::disk('media')->deleteDirectory("products/{$key}");
        }
    }
}
