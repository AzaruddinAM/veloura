<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'sort'])]
class Category extends Model
{
    protected static function booted(): void
    {
        static::saved(fn () => Product::forgetCatalogue());
        static::deleted(fn () => Product::forgetCatalogue());
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
