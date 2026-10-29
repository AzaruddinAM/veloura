<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Shop settings changed from the admin panel. Each one falls back to its
 * default in config/shop.php until it has been saved.
 */
#[Fillable(['key', 'value'])]
class Setting extends Model
{
    /** Allowed values per setting. */
    public const OPTIONS = [
        'photo_theme' => ['cover', 'light', 'dark', 'real-white', 'real-dark'],
    ];

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected static function booted(): void
    {
        // The storefront catalogue includes the settings.
        static::saved(fn () => Product::forgetCatalogue());
    }

    public static function get(string $key): string
    {
        $value = static::find($key)?->value ?? config("shop.{$key}");

        // A bad value in .env must not break the shop.
        return in_array($value, self::OPTIONS[$key], true) ? $value : self::OPTIONS[$key][0];
    }

    public static function put(string $key, string $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
    }

    /** Every setting with its current value. @return array<string, string> */
    public static function values(): array
    {
        return collect(array_keys(self::OPTIONS))->mapWithKeys(fn ($k) => [$k => self::get($k)])->all();
    }
}
