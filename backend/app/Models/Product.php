<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

#[Fillable(['category_id', 'name', 'note', 'price', 'was_price', 'stock', 'is_active', 'sort', 'themes'])]
class Product extends Model
{
    public const CATALOGUE_CACHE_KEY = 'catalogue.v4';

    /** At or below this many pieces a product counts as low on stock. */
    public const LOW_STOCK = 3;

    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'was_price' => 'integer',
            // Pieces in stock; null = not tracked (no limit).
            'stock' => 'integer',
            'is_active' => 'boolean',
            // Photo types this product shows, e.g. ["light","real-white"]; null follows the shop setting.
            'themes' => 'array',
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

    public function takeStock(int $qty): void
    {
        if ($this->stock !== null) {
            $this->stock = max(0, $this->stock - $qty);
            $this->save();
        }
    }

    public function returnStock(int $qty): void
    {
        if ($this->stock !== null) {
            $this->stock += $qty;
            $this->save();
        }
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /** Photos in display order; the first one is the cover. */
    public function photos(): HasMany
    {
        return $this->hasMany(ProductPhoto::class)->orderBy('sort')->orderBy('id');
    }

    /**
     * Cover photo URLs (img, srcset, thumb), or nulls when there is no photo.
     *
     * @return array{img: ?string, srcset: ?string, thumb: ?string}
     */
    public function imageSet(): array
    {
        return $this->photos->first()?->set() ?? ['img' => null, 'srcset' => null, 'thumb' => null];
    }

    /**
     * Photos the shop shows: those of the product's own photo types, else the shop's.
     * When none match, the cover is shown so the product never disappears.
     * With a cover type (e.g. 'real-white'), the first photo of that type moves to the
     * front and becomes the cover; 'product' keeps the product's own order.
     *
     * @param  list<string>  $shopThemes
     */
    public function shopPhotos(array $shopThemes, string $coverTheme = 'product'): Collection
    {
        $themes = $this->themes ?: $shopThemes;
        $shown = $this->photos->filter(fn (ProductPhoto $ph) => in_array($ph->theme, $themes, true))->values();
        if ($shown->isEmpty()) {
            return $this->photos->take(1)->values();
        }

        $cover = $shown->search(fn (ProductPhoto $ph) => $ph->theme === $coverTheme);
        if ($cover === false || $cover === 0) {
            return $shown;
        }

        $first = $shown[$cover];

        return $shown->reject(fn (ProductPhoto $ph) => $ph->is($first))->prepend($first)->values();
    }

    /** Shape used by the admin panel. */
    public function toAdmin(): array
    {
        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'category' => $this->category?->name,
            'name' => $this->name,
            'note' => $this->note,
            'price' => $this->price,
            'was_price' => $this->was_price,
            'is_active' => $this->is_active,
            'sort' => $this->sort,
            'stock' => $this->stock,
            'themes' => $this->themes,
            ...$this->imageSet(),
            'photos' => $this->photos->map->toAdmin()->values(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
