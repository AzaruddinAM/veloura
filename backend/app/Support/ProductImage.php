<?php

namespace App\Support;

use App\Models\ProductPhoto;
use GdImage;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Turns any uploaded photo (jpg/png/webp/avif/gif) into a set of small,
 * square WebP files using PHP's built-in GD extension (free, no services).
 *
 * The storefront shows product photos in square boxes, so we save exactly the
 * square that should be seen: either the one the admin chose in the cropper or
 * the centre square. The browser then downloads far fewer bytes, and the bag
 * thumbnail (64px) gets its own 160px file instead of the full photo.
 *
 * Files:
 *  - public/media/originals/{hash}.webp       full photo (max 2000px), for re-cropping later
 *  - public/media/products/{key}/{size}.webp  the squares; {key} changes with photo or crop,
 *                                             so the web server can cache them forever
 */
class ProductImage
{
    /** Square edge lengths in px. Covers a 64px bag thumb up to a full-width card on a 3x phone. */
    public const SIZES = [160, 320, 480, 640, 960];

    public const QUALITY = 80;

    public const ORIGINAL_MAX = 2000;

    /**
     * @param  array{x: float, y: float, size: float}|null  $crop  Square to keep, as fractions:
     *                                                             x and size of the width, y of the height.
     * @return array{key: string, sizes: list<int>, original: string, crop: array{x: float, y: float, size: float}, theme: string}
     */
    public function store(string $path, ?array $crop = null): array
    {
        $bytes = @file_get_contents($path);
        $src = $bytes === false ? false : @imagecreatefromstring($bytes);
        if ($src === false) {
            throw new RuntimeException('The file is not a readable image.');
        }
        $src = $this->limit($this->orient($src, $bytes), self::ORIGINAL_MAX);

        $original = substr(sha1($bytes), 0, 20).'.webp';
        $disk = Storage::disk('media');
        if (! $disk->exists("originals/{$original}")) {
            $disk->put("originals/{$original}", $this->webp($src, 85));
        }

        return [...$this->squares($src, $original, $crop), 'theme' => $this->theme($src)];
    }

    /**
     * Make a new square from a photo that was uploaded before.
     *
     * @return array{key: string, sizes: list<int>, original: string, crop: array{x: float, y: float, size: float}}
     */
    public function recrop(string $original, ?array $crop): array
    {
        $disk = Storage::disk('media');
        $bytes = $disk->exists("originals/{$original}") ? $disk->get("originals/{$original}") : null;
        $src = $bytes ? @imagecreatefromstring($bytes) : false;
        if ($src === false) {
            throw new RuntimeException('The original photo is missing. Please upload it again.');
        }

        return $this->squares($src, $original, $crop);
    }

    /** Remove image files once no product points at them any more. */
    public function deleteIfUnused(?string $key, ?string $original = null): void
    {
        $disk = Storage::disk('media');
        if ($key && ! ProductPhoto::where('image_key', $key)->exists()) {
            $disk->deleteDirectory("products/{$key}");
        }
        if ($original && ! ProductPhoto::where('image_original', $original)->exists()) {
            $disk->delete("originals/{$original}");
        }
    }

    /** @return array{key: string, sizes: list<int>, original: string, crop: array{x: float, y: float, size: float}} */
    private function squares(GdImage $src, string $original, ?array $crop): array
    {
        [$x, $y, $side] = $this->box(imagesx($src), imagesy($src), $crop);

        // Never upscale: keep the sizes the square can fill, plus its own edge
        // when that is meaningfully bigger than the largest of those.
        $sizes = array_values(array_filter(self::SIZES, fn ($s) => $s <= $side));
        if ($side < max(self::SIZES) && (! $sizes || $side > end($sizes) * 1.1)) {
            $sizes[] = $side;
        }

        $key = substr(sha1("{$original}|{$x},{$y},{$side}"), 0, 20);
        $disk = Storage::disk('media');

        foreach ($sizes as $size) {
            $dst = imagecreatetruecolor($size, $size);
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            imagecopyresampled($dst, $src, 0, 0, $x, $y, $size, $size, $side, $side);
            $disk->put("products/{$key}/{$size}.webp", $this->webp($dst, self::QUALITY));
        }

        $w = imagesx($src);
        $crop = ['x' => round($x / $w, 5), 'y' => round($y / imagesy($src), 5), 'size' => round($side / $w, 5)];

        return ['key' => $key, 'sizes' => $sizes, 'original' => $original, 'crop' => $crop];
    }

    /** @return array{int, int, int} left, top and edge of the square, in pixels */
    private function box(int $w, int $h, ?array $crop): array
    {
        $max = min($w, $h);
        if (! $crop) {
            return [intdiv($w - $max, 2), intdiv($h - $max, 2), $max];
        }

        $side = (int) max(1, min($max, round($crop['size'] * $w)));
        $x = (int) max(0, min($w - $side, round($crop['x'] * $w)));
        $y = (int) max(0, min($h - $side, round($crop['y'] * $h)));

        return [$x, $y, $side];
    }

    /** 'dark' or 'light' from the average brightness of the whole photo. */
    private function theme(GdImage $img): string
    {
        $px = imagecreatetruecolor(1, 1);
        imagecopyresampled($px, $img, 0, 0, 0, 0, 1, 1, imagesx($img), imagesy($img));
        $c = imagecolorat($px, 0, 0);
        $luma = 0.299 * (($c >> 16) & 255) + 0.587 * (($c >> 8) & 255) + 0.114 * ($c & 255);

        return $luma < 128 ? 'dark' : 'light';
    }

    private function limit(GdImage $img, int $max): GdImage
    {
        $w = imagesx($img);
        $h = imagesy($img);
        if (max($w, $h) <= $max) {
            return $img;
        }
        $scale = $max / max($w, $h);

        return imagescale($img, (int) round($w * $scale), (int) round($h * $scale), IMG_BICUBIC);
    }

    private function webp(GdImage $img, int $quality): string
    {
        ob_start();
        imagewebp($img, null, $quality);

        return ob_get_clean();
    }

    /**
     * Phones save photos sideways and note the rotation in EXIF. Browsers (and so
     * the admin cropper) apply it; GD does not, so we apply it here.
     */
    private function orient(GdImage $img, string $bytes): GdImage
    {
        return match ($this->exifOrientation($bytes)) {
            2 => $this->flipped($img, IMG_FLIP_HORIZONTAL),
            3 => imagerotate($img, 180, 0),
            4 => $this->flipped($img, IMG_FLIP_VERTICAL),
            5 => $this->flipped(imagerotate($img, 90, 0), IMG_FLIP_VERTICAL),
            6 => imagerotate($img, -90, 0),
            7 => $this->flipped(imagerotate($img, -90, 0), IMG_FLIP_VERTICAL),
            8 => imagerotate($img, 90, 0),
            default => $img,
        };
    }

    private function flipped(GdImage $img, int $mode): GdImage
    {
        imageflip($img, $mode);

        return $img;
    }

    /** Reads the EXIF Orientation tag from a JPEG without needing the exif extension. */
    private function exifOrientation(string $d): int
    {
        if (! str_starts_with($d, "\xFF\xD8")) {
            return 1;
        }
        $len = strlen($d);
        $o = 2;
        while ($o + 4 <= $len && $d[$o] === "\xFF") {
            $marker = ord($d[$o + 1]);
            $size = unpack('n', $d, $o + 2)[1];
            if ($marker === 0xE1 && substr($d, $o + 4, 6) === "Exif\0\0") {
                $t = $o + 10;
                $le = substr($d, $t, 2) === 'II';
                $u16 = fn ($p) => $p + 2 <= $len ? unpack($le ? 'v' : 'n', $d, $p)[1] : 0;
                $u32 = fn ($p) => $p + 4 <= $len ? unpack($le ? 'V' : 'N', $d, $p)[1] : 0;
                $ifd = $t + $u32($t + 4);
                $count = $u16($ifd);
                for ($i = 0; $i < $count; $i++) {
                    $e = $ifd + 2 + $i * 12;
                    if ($u16($e) === 0x0112) {
                        $v = $u16($e + 8);

                        return $v >= 1 && $v <= 8 ? $v : 1;
                    }
                }

                return 1;
            }
            if ($marker === 0xDA) {
                break; // image data starts; no EXIF before it
            }
            $o += 2 + $size;
        }

        return 1;
    }
}
