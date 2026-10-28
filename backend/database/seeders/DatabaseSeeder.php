<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Support\ProductImage;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Load the current Veloura catalogue (same items, prices and photos as the
     * original site) so the shop works straight after install.
     */
    public function run(ProductImage $images): void
    {
        $cats = collect(['Necklaces', 'Bangles', 'Sets', 'Bracelets', 'Watches'])
            ->mapWithKeys(fn ($name, $i) => [$name => Category::firstOrCreate(['name' => $name], ['sort' => $i + 1])->id]);

        $items = [
            ['Blossom Vine Necklace', 'Necklaces', 799, 1199, 'p1', 'Emerald-accent AD flowers'],
            ['Emerald Serpent Bangle', 'Bangles', 999, 1499, 'p2', 'White enamel, pavé head'],
            ['Cherry Blossom Cuff', 'Bangles', 1099, 1599, 'p3', 'Openable, AD stone rails'],
            ['Hexa Edge Bangle', 'Bangles', 699, 999, 'p4', 'Rust proof, minimal shine'],
            ['Pastel Leaf Set', 'Sets', 899, 1299, 'p5', 'Pendant and studs'],
            ['Indigo Bloom Set', 'Sets', 999, 1399, 'p6', 'Enamel petals, blue AD centre'],
            ['Violet Leaf Set', 'Sets', 899, 1299, 'p7', 'Pendant and studs'],
            ['Lotus Pearl Set', 'Sets', 1199, 1699, 'p8', 'Pearl centre, enamel petals'],
            ['Golden Hour Watch', 'Watches', 1299, 1899, 'p9', 'Slim bracelet strap'],
            ['Coastal Charm Pendant', 'Necklaces', 599, 899, 'p10', 'Palm, shell and drink charms'],
            ['Pearl Shell Pendant', 'Necklaces', 649, 949, 'p11', 'Starfish with AD stones'],
            ['Twin Star Lariat', 'Bracelets', 549, 799, 'p12', 'Adjustable slider, green stars'],
        ];

        foreach ($items as $i => [$name, $cat, $price, $was, $img, $note]) {
            $product = Product::firstOrNew(['name' => $name]);
            $product->fill([
                'category_id' => $cats[$cat],
                'note' => $note,
                'price' => $price,
                'was_price' => $was,
                'sort' => $i + 1,
                'is_active' => true,
            ]);
            $stored = $images->store(__DIR__."/images/{$img}.webp");
            $product->image_key = $stored['key'];
            $product->image_sizes = $stored['sizes'];
            $product->save();
        }
    }
}
