<?php

namespace Tests\Unit;

use App\Support\ProductImage;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProductImageTest extends TestCase
{
    /** A JPEG that is 400 wide x 200 tall on disk, left half red, right half blue. */
    private function jpeg(?int $orientation = null): string
    {
        $img = imagecreatetruecolor(400, 200);
        imagefilledrectangle($img, 0, 0, 199, 199, imagecolorallocate($img, 255, 0, 0));
        imagefilledrectangle($img, 200, 0, 399, 199, imagecolorallocate($img, 0, 0, 255));
        ob_start();
        imagejpeg($img, null, 95);
        $jpeg = ob_get_clean();

        if ($orientation) {
            // Minimal big-endian EXIF block with one IFD0 entry: Orientation.
            $tiff = 'MM'.pack('n', 42).pack('N', 8).pack('n', 1)
                .pack('n', 0x0112).pack('n', 3).pack('N', 1).pack('n', $orientation).pack('n', 0)
                .pack('N', 0);
            $app1 = "Exif\0\0".$tiff;
            $jpeg = "\xFF\xD8\xFF\xE1".pack('n', strlen($app1) + 2).$app1.substr($jpeg, 2);
        }

        $path = tempnam(sys_get_temp_dir(), 'img');
        file_put_contents($path, $jpeg);

        return $path;
    }

    private function pixel(string $file, int $x, int $y): array
    {
        $img = imagecreatefromwebp($file);
        $c = imagecolorat($img, $x, $y);

        return [($c >> 16) & 255, ($c >> 8) & 255, $c & 255];
    }

    public function test_default_is_the_centre_square_and_custom_crop_is_respected(): void
    {
        Storage::fake('media');
        $images = new ProductImage;

        $centre = $images->store($this->jpeg());
        $this->assertSame([160, 200], $centre['sizes']);

        // Left square = all red.
        $left = $images->store($this->jpeg(), ['x' => 0, 'y' => 0, 'size' => 0.5]);
        [$r, , $b] = $this->pixel(Storage::disk('media')->path("products/{$left['key']}/160.webp"), 150, 80);
        $this->assertGreaterThan(200, $r);
        $this->assertLessThan(60, $b);
        $this->assertNotSame($centre['key'], $left['key']);
        $this->assertSame($centre['original'], $left['original']);

        // Out-of-range crops are clamped inside the photo instead of failing.
        $clamped = $images->recrop($left['original'], ['x' => 0.9, 'y' => 0.9, 'size' => 1]);
        $this->assertSame([160, 200], $clamped['sizes']);
    }

    public function test_phone_photos_are_turned_upright_using_exif(): void
    {
        Storage::fake('media');

        // Orientation 6 = rotate 90° clockwise: the 400x200 photo becomes 200x400,
        // red on top and blue at the bottom.
        $res = (new ProductImage)->store($this->jpeg(6), ['x' => 0, 'y' => 0, 'size' => 1]);
        $file = Storage::disk('media')->path("products/{$res['key']}/160.webp");

        [$r, , $b] = $this->pixel($file, 80, 20);
        $this->assertGreaterThan(200, $r, 'top should be red');
        $this->assertLessThan(60, $b);

        [$w, $h] = getimagesize(Storage::disk('media')->path("originals/{$res['original']}"));
        $this->assertSame([200, 400], [$w, $h]);
    }
}
