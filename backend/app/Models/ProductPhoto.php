<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/** One photo of a product. Files are made by App\Support\ProductImage. */
#[Fillable(['image_key', 'image_sizes', 'image_original', 'image_crop', 'theme', 'sort'])]
class ProductPhoto extends Model
{
    /**
     * Photo types: studio photos on a plain light or dark background, and "real" staged
     * photos with the piece on a white display box or a dark velvet box.
     * Uploads are detected as light or dark; the real types are chosen in the admin panel.
     */
    public const THEMES = ['light', 'dark', 'real-white', 'real-dark'];

    protected $table = 'product_images';

    protected function casts(): array
    {
        return [
            'image_sizes' => 'array',
            'image_crop' => 'array',
            'sort' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saved(fn () => Product::forgetCatalogue());
        static::deleted(fn () => Product::forgetCatalogue());
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** Attributes from ProductImage::store()/recrop() output. */
    public static function fromStored(array $stored): array
    {
        return [
            'image_key' => $stored['key'],
            'image_sizes' => $stored['sizes'],
            'image_original' => $stored['original'],
            'image_crop' => $stored['crop'],
        ];
    }

    public function url(int $size): string
    {
        return Storage::disk('media')->url("products/{$this->image_key}/{$size}.webp");
    }

    /**
     * Image URLs for the storefront: a default src, a srcset for the browser to
     * pick the smallest file that looks sharp, and a tiny thumb for the bag.
     *
     * @return array{img: string, srcset: string, thumb: string}
     */
    public function set(): array
    {
        $sizes = $this->image_sizes;
        $default = collect($sizes)->filter(fn ($s) => $s <= 640)->max() ?? min($sizes);

        return [
            'img' => $this->url($default),
            'srcset' => collect($sizes)->map(fn ($s) => $this->url($s)." {$s}w")->implode(', '),
            'thumb' => $this->url(min($sizes)),
        ];
    }

    /** Shape used by the admin panel. */
    public function toAdmin(): array
    {
        return [
            'id' => $this->id,
            'theme' => $this->theme,
            'sort' => $this->sort,
            'crop' => $this->image_crop,
            'original' => Storage::disk('media')->url("originals/{$this->image_original}"),
            ...$this->set(),
        ];
    }
}
