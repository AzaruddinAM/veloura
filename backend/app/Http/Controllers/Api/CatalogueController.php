<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductPhoto;
use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

class CatalogueController extends Controller
{
    /**
     * Categories and active products in one response, so the site needs a
     * single request. Cached until a product, photo or category is edited.
     */
    public function __invoke()
    {
        // Plain arrays only: the cache refuses to unserialize objects (config/cache.php).
        return Cache::rememberForever(Product::CATALOGUE_CACHE_KEY, function () {
            $products = Product::with(['category', 'photos'])
                ->where('is_active', true)
                ->has('photos')
                ->orderBy('sort')
                ->orderBy('id')
                ->get();

            $used = $products->pluck('category_id')->unique();

            return [
                // e.g. photo_theme: which photo cards show first ('cover', 'light' or 'dark').
                'settings' => Setting::values(),
                'categories' => Category::orderBy('sort')->orderBy('name')->get()
                    ->filter(fn (Category $c) => $used->contains($c->id))
                    ->pluck('name')
                    ->values()
                    ->all(),
                'products' => $products->map(fn (Product $p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'cat' => $p->category->name,
                    'price' => $p->price,
                    'was' => $p->was_price,
                    'note' => $p->note,
                    // Cover photo at the top level (the bag and older pages use it) ...
                    ...$p->imageSet(),
                    // ... and every photo, e.g. light and dark background versions.
                    'images' => $p->photos->map(fn (ProductPhoto $ph) => [...$ph->set(), 'theme' => $ph->theme])->values()->all(),
                ])->values()->all(),
            ];
        });
    }
}
