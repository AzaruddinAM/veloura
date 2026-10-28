<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

#[Fillable(['category_id', 'name', 'note', 'price', 'was_price', 'is_active', 'sort'])]
class Product extends Model
{
    public const CATALOGUE_CACHE_KEY = 'catalogue.v1';

    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'was_price' => 'integer',
            'image_sizes' => 'array',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::saved(fn () => self::forgetCatalogue());
        static::deleted(fn () => self::forgetCatalogue());
    }

    public static function forgetCatalogue(): void
    {
        Cache::forget(self::CATALOGUE_CACHE_KEY);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function imageUrl(int $size): string
    {
        return Storage::disk('media')->url("products/{$this->image_key}/{$size}.webp");
    }

    /**
     * Image URLs for the storefront: a default src, a srcset for the browser to
     * pick the smallest file that looks sharp, and a tiny thumb for the bag.
     *
     * @return array{img: ?string, srcset: ?string, thumb: ?string}
     */
    public function imageSet(): array
    {
        $sizes = $this->image_sizes ?? [];
        if (! $this->image_key || ! $sizes) {
            return ['img' => null, 'srcset' => null, 'thumb' => null];
        }

        $default = collect($sizes)->filter(fn ($s) => $s <= 640)->max() ?? min($sizes);

        return [
            'img' => $this->imageUrl($default),
            'srcset' => collect($sizes)->map(fn ($s) => $this->imageUrl($s)." {$s}w")->implode(', '),
            'thumb' => $this->imageUrl(min($sizes)),
        ];
    }
}
