<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Shop settings changed from the admin panel. Each one falls back to its
 * default in config/shop.php until it has been saved.
 *
 * List settings hold one or more allowed values (stored comma-separated);
 * single settings (see SINGLE) hold exactly one.
 */
#[Fillable(['key', 'value'])]
class Setting extends Model
{
    /** Allowed values per setting. For single settings the first value is the fallback. */
    public const OPTIONS = [
        // Photo types the shop shows (each product can choose its own instead).
        'photo_themes' => ProductPhoto::THEMES,
        // Photo type used as the cover (first photo, also in the bag); 'product' keeps each product's own.
        'cover_theme' => ['product', ...ProductPhoto::THEMES],
    ];

    /** Settings that hold one value instead of a list. */
    public const SINGLE = ['cover_theme'];

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected static function booted(): void
    {
        // The storefront catalogue depends on the settings.
        static::saved(fn () => Product::forgetCatalogue());
    }

    public static function isSingle(string $key): bool
    {
        return in_array($key, self::SINGLE, true);
    }

    /** @return list<string>|string */
    public static function get(string $key): array|string
    {
        $value = static::find($key)?->value ?? config("shop.{$key}");
        $list = is_array($value) ? $value : explode(',', (string) $value);

        // Unknown values (e.g. a typo in .env) are dropped, kept in the allowed order.
        $valid = array_values(array_intersect(self::OPTIONS[$key], array_map('trim', $list)));

        // If nothing valid is left the shop must not break: a list allows everything,
        // a single setting uses its first option.
        if (self::isSingle($key)) {
            return $valid[0] ?? self::OPTIONS[$key][0];
        }

        return $valid ?: self::OPTIONS[$key];
    }

    /** @param list<string>|string $values */
    public static function put(string $key, array|string $values): void
    {
        static::updateOrCreate(['key' => $key], ['value' => implode(',', array_unique((array) $values))]);
    }

    /** Every setting with its current value. @return array<string, list<string>|string> */
    public static function values(): array
    {
        return collect(array_keys(self::OPTIONS))->mapWithKeys(fn ($k) => [$k => self::get($k)])->all();
    }
}
