<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

#[Fillable(['category_id', 'name', 'note', 'price', 'was_price', 'is_active', 'sort'])]
class Product extends Model
{
    public const CATALOGUE_CACHE_KEY = 'catalogue.v2';

    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'was_price' => 'integer',
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
            ...$this->imageSet(),
            'photos' => $this->photos->map->toAdmin()->values(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
