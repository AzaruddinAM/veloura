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
            $themes = Setting::get('photo_themes');
            $cover = Setting::get('cover_theme');

            return [
                'categories' => Category::orderBy('sort')->orderBy('name')->get()
                    ->filter(fn (Category $c) => $used->contains($c->id))
                    ->pluck('name')
                    ->values()
                    ->all(),
                'products' => $products->map(function (Product $p) use ($themes, $cover) {
                    // Only the chosen photo types (the product's own, else the shop's), cover type first.
                    $photos = $p->shopPhotos($themes, $cover);

                    return [
                        'id' => $p->id,
                        'name' => $p->name,
                        'cat' => $p->category->name,
                        'price' => $p->price,
                        'was' => $p->was_price,
                        'note' => $p->note,
                    // Pieces in stock (null = not tracked); the site limits the bag to this.
                    'stock' => $p->stock,
                        // First shown photo at the top level (the bag uses it) ...
                        ...$photos->first()->set(),
                        // ... and every shown photo; with one, cards have no photo switcher.
                        'images' => $photos->map(fn (ProductPhoto $ph) => [...$ph->set(), 'theme' => $ph->theme])->all(),
                    ];
                })->values()->all(),
            ];
        });
    }
}
