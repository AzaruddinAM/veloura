<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Support\Facades\Cache;

class CatalogueController extends Controller
{
    /**
     * Categories and active products in one response, so the site needs a
     * single request. Cached until a product or category is edited.
     */
    public function __invoke()
    {
        // Plain arrays only: the cache refuses to unserialize objects (config/cache.php).
        return Cache::rememberForever(Product::CATALOGUE_CACHE_KEY, function () {
            $products = Product::with('category')
                ->where('is_active', true)
                ->whereNotNull('image_key')
                ->orderBy('sort')
                ->orderBy('id')
                ->get();

            $used = $products->pluck('category_id')->unique();

            return [
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
                    ...$p->imageSet(),
                ])->values()->all(),
            ];
        });
    }
}
