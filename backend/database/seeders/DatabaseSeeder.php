<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductPhoto;
use App\Support\ProductImage;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * The Veloura catalogue. Photos are in database/seeders/images/{slug}.webp;
     * a product can list several (the first is the cover). Each photo is marked
     * light or dark automatically from its background.
     *
     * The photos are studio versions of the original posters: the jewellery was cut out
     * and placed on a cream (light) and a cocoa (dark) background. The cover keeps the
     * look of the original poster. Most pieces also have two "real" staged photos: on a white
     * display box (real-white) and on a dark velvet box (real-dark).
     *
     * Running the seeder again replaces the whole catalogue with this list.
     * The prices of pieces added in October 2026 are placeholders: set the real
     * ones in the admin panel.
     */
    private const PRODUCTS = [
        // name, category, price, MRP, note, photos
        ['Blossom Vine Necklace', 'Necklaces', 799, 1199, 'Emerald-accent AD flowers', ['blossom-vine-necklace-light', 'blossom-vine-necklace-dark', 'blossom-vine-necklace-real-white', 'blossom-vine-necklace-real-dark']],
        ['Emerald Serpent Bangle', 'Bangles', 999, 1499, 'White enamel, pavé head', ['emerald-serpent-bangle-light', 'emerald-serpent-bangle-dark', 'emerald-serpent-bangle-real-white', 'emerald-serpent-bangle-real-dark']],
        ['Cherry Blossom Cuff', 'Bangles', 1099, 1599, 'Openable, AD stone rails', ['cherry-blossom-cuff-light', 'cherry-blossom-cuff-dark', 'cherry-blossom-cuff-real-white', 'cherry-blossom-cuff-real-dark']],
        ['Hexa Edge Bangle', 'Bangles', 699, 999, 'Rust proof, minimal shine', ['hexa-edge-bangle-light', 'hexa-edge-bangle-dark', 'hexa-edge-bangle-real-white', 'hexa-edge-bangle-real-dark']],
        ['Pastel Leaf Set', 'Sets', 899, 1299, 'Pendant and studs', ['pastel-leaf-set-dark', 'pastel-leaf-set-light', 'pastel-leaf-set-real-white', 'pastel-leaf-set-real-dark']],
        ['Indigo Bloom Set', 'Sets', 999, 1399, 'Enamel petals, blue AD centre', ['indigo-bloom-set-dark', 'indigo-bloom-set-light', 'indigo-bloom-set-real-white', 'indigo-bloom-set-real-dark']],
        ['Violet Leaf Set', 'Sets', 899, 1299, 'Pendant and studs', ['violet-leaf-set-dark', 'violet-leaf-set-light', 'violet-leaf-set-real-white', 'violet-leaf-set-real-dark']],
        ['Lotus Pearl Set', 'Sets', 1199, 1699, 'Pearl centre, enamel petals', ['lotus-pearl-set-dark', 'lotus-pearl-set-light', 'lotus-pearl-set-real-white', 'lotus-pearl-set-real-dark']],
        ['Golden Hour Watch', 'Watches', 1299, 1899, 'Slim bracelet strap', ['golden-hour-watch-dark', 'golden-hour-watch-light', 'golden-hour-watch-real-white', 'golden-hour-watch-real-dark']],
        ['Coastal Charm Pendant', 'Necklaces', 599, 899, 'Palm, shell and drink charms', ['coastal-charm-pendant-dark', 'coastal-charm-pendant-light', 'coastal-charm-pendant-real-white', 'coastal-charm-pendant-real-dark']],
        ['Pearl Shell Pendant', 'Necklaces', 649, 949, 'Starfish with AD stones', ['pearl-shell-pendant-dark', 'pearl-shell-pendant-light', 'pearl-shell-pendant-real-white', 'pearl-shell-pendant-real-dark']],
        ['Twin Star Lariat', 'Bracelets', 549, 799, 'Adjustable slider, green stars', ['twin-star-lariat-dark', 'twin-star-lariat-light', 'twin-star-lariat-real-white', 'twin-star-lariat-real-dark']],

        // Added October 2026: placeholder prices.
        ['Baguette Crystal Bangle', 'Bangles', 799, 1199, 'A row of baguette AD stones', ['baguette-crystal-bangle-light', 'baguette-crystal-bangle-dark', 'baguette-crystal-bangle-real-white', 'baguette-crystal-bangle-real-dark']],
        ['Ivory Weave Cuff', 'Bangles', 799, 1199, 'White braided enamel, open cuff', ['ivory-weave-cuff-dark', 'ivory-weave-cuff-light', 'ivory-weave-cuff-real-white', 'ivory-weave-cuff-real-dark']],
        ['Daisy Duo Bangle', 'Bangles', 799, 1199, 'Flower charms beside an AD row', ['daisy-duo-bangle-dark', 'daisy-duo-bangle-light', 'daisy-duo-bangle-real-white', 'daisy-duo-bangle-real-dark']],
        ['Bamboo Bangle', 'Bangles', 799, 1199, 'Smooth gold bamboo links', ['bamboo-bangle-dark', 'bamboo-bangle-light', 'bamboo-bangle-real-white', 'bamboo-bangle-real-dark']],
        ['Crescent Pavé Bangle', 'Bangles', 799, 1199, 'Pavé AD with a white enamel moon', ['crescent-pave-bangle-dark', 'crescent-pave-bangle-real-dark']],
        ['Twin Row Sparkle Bangle', 'Bangles', 799, 1199, 'Two gold rows with an AD line', ['twin-row-sparkle-bangle-dark', 'twin-row-sparkle-bangle-light', 'twin-row-sparkle-bangle-real-white', 'twin-row-sparkle-bangle-real-dark']],
        ['Emerald Solitaire Bangle', 'Bangles', 799, 1199, 'Green stone between AD rails', ['emerald-solitaire-bangle-dark', 'emerald-solitaire-bangle-light', 'emerald-solitaire-bangle-real-white', 'emerald-solitaire-bangle-real-dark']],
        ['Square Crystal Bangle', 'Bangles', 799, 1199, 'Square-cut AD all round', ['square-crystal-bangle-dark', 'square-crystal-bangle-real-dark']],
        ['Daisy Line Bangle', 'Bangles', 799, 1199, 'Little daisies on an AD band', ['daisy-line-bangle-dark', 'daisy-line-bangle-light', 'daisy-line-bangle-real-white', 'daisy-line-bangle-real-dark']],
        ['Bow Crystal Bangle', 'Bangles', 799, 1199, 'Gold bow on an AD band', ['bow-crystal-bangle-dark', 'bow-crystal-bangle-light', 'bow-crystal-bangle-real-white', 'bow-crystal-bangle-real-dark']],
        ['Leaf Wave Bangle', 'Bangles', 799, 1199, 'Twisting band with a leaf spray', ['leaf-wave-bangle-dark', 'leaf-wave-bangle-light', 'leaf-wave-bangle-real-white', 'leaf-wave-bangle-real-dark']],
        ['Butterfly Crystal Bangle', 'Bangles', 799, 1199, 'Wire bangle with AD butterflies', ['butterfly-crystal-bangle-dark', 'butterfly-crystal-bangle-light', 'butterfly-crystal-bangle-real-white', 'butterfly-crystal-bangle-real-dark']],
        ['Pearl Letter Necklace', 'Necklaces', 649, 949, 'Curb chain, pearl and AD letters', ['pearl-letter-necklace-dark', 'pearl-letter-necklace-light', 'pearl-letter-necklace-real-white', 'pearl-letter-necklace-real-dark']],
        ['Clover Charm Necklace', 'Necklaces', 649, 949, 'Chain with clover and star charms', ['clover-charm-necklace-dark', 'clover-charm-necklace-light', 'clover-charm-necklace-real-white', 'clover-charm-necklace-real-dark']],
        ['Star Drop Lariat', 'Necklaces', 649, 949, 'Adjustable slider, open stars', ['star-drop-lariat-dark', 'star-drop-lariat-light', 'star-drop-lariat-real-white', 'star-drop-lariat-real-dark']],
        ['Golden Bow Necklace', 'Necklaces', 649, 949, 'Bow pendant with AD drops', ['golden-bow-necklace-dark', 'golden-bow-necklace-light', 'golden-bow-necklace-real-white', 'golden-bow-necklace-real-dark']],
        ['Golden Lily Pendant', 'Necklaces', 649, 949, 'Sculpted lily on a beaded chain', ['golden-lily-pendant-dark', 'golden-lily-pendant-light', 'golden-lily-pendant-real-white', 'golden-lily-pendant-real-dark']],
        ['Clover Station Necklace', 'Necklaces', 649, 949, 'White clovers along the chain', ['clover-station-necklace-dark', 'clover-station-necklace-light', 'clover-station-necklace-real-white', 'clover-station-necklace-real-dark']],
        ['Butterfly Charm Bracelet', 'Bracelets', 549, 799, 'Link chain with enamel charms', ['butterfly-charm-bracelet-dark', 'butterfly-charm-bracelet-light', 'butterfly-charm-bracelet-real-white', 'butterfly-charm-bracelet-real-dark']],
        ['Blush Blossom Set', 'Sets', 899, 1299, 'Pink enamel flowers, pendant and studs', ['blush-blossom-set-dark', 'blush-blossom-set-light', 'blush-blossom-set-real-white', 'blush-blossom-set-real-dark']],
        ['Sapphire Blossom Set', 'Sets', 899, 1299, 'Blue enamel flower, pendant and studs', ['sapphire-blossom-set-dark', 'sapphire-blossom-set-light', 'sapphire-blossom-set-real-white', 'sapphire-blossom-set-real-dark']],
        ['Emerald Cube Set', 'Sets', 899, 1299, 'Green stones with AD clusters', ['emerald-cube-set-dark', 'emerald-cube-set-light', 'emerald-cube-set-real-white', 'emerald-cube-set-real-dark']],
        ['Starfish Set', 'Sets', 899, 1299, 'AD starfish pendant and studs', ['starfish-set-dark', 'starfish-set-light', 'starfish-set-real-white', 'starfish-set-real-dark']],
        ['Ruby Pearl Set', 'Sets', 899, 1299, 'Red stones with pearls', ['ruby-pearl-set-dark', 'ruby-pearl-set-light', 'ruby-pearl-set-real-white', 'ruby-pearl-set-real-dark']],
        ['Love Knot Set', 'Sets', 899, 1299, 'White enamel knots', ['love-knot-set-dark', 'love-knot-set-light', 'love-knot-set-real-white', 'love-knot-set-real-dark']],
        ['Crystal Dome Set', 'Sets', 899, 1299, 'Ribbed AD domes', ['crystal-dome-set-dark', 'crystal-dome-set-light', 'crystal-dome-set-real-white', 'crystal-dome-set-real-dark']],
        ['Jade Swirl Set', 'Sets', 899, 1299, 'Green and white enamel swirl', ['jade-swirl-set-dark', 'jade-swirl-set-light', 'jade-swirl-set-real-white', 'jade-swirl-set-real-dark']],
        ['Aqua Garden Set', 'Sets', 899, 1299, 'Aqua stones with tiny flowers', ['aqua-garden-set-dark', 'aqua-garden-set-light', 'aqua-garden-set-real-white', 'aqua-garden-set-real-dark']],
    ];

    public function run(ProductImage $images): void
    {
        $cats = collect(['Necklaces', 'Bangles', 'Sets', 'Bracelets', 'Watches'])
            ->mapWithKeys(fn ($name, $i) => [$name => Category::firstOrCreate(['name' => $name], ['sort' => $i + 1])->id]);

        // Replace the whole catalogue (past orders keep their own copy of names and prices).
        foreach (ProductPhoto::all() as $old) {
            $old->delete();
            $images->deleteIfUnused($old->image_key, $old->image_original);
        }
        Product::query()->delete();

        foreach (self::PRODUCTS as $i => [$name, $cat, $price, $was, $note, $photos]) {
            $product = Product::create([
                'category_id' => $cats[$cat],
                'name' => $name,
                'note' => $note,
                'price' => $price,
                'was_price' => $was,
                // Starting stock; set the real numbers in the admin panel.
                'stock' => 10,
                'sort' => $i + 1,
                'is_active' => true,
            ]);
            foreach ($photos as $sort => $slug) {
                $stored = $images->store(__DIR__."/images/{$slug}.webp");
                // The type is in the file name (e.g. lotus-pearl-set-real-dark); otherwise it is detected.
                $theme = collect(ProductPhoto::THEMES)->sortByDesc(fn ($t) => strlen($t))->first(fn ($t) => str_ends_with($slug, "-{$t}")) ?? $stored['theme'];
                $product->photos()->create([...ProductPhoto::fromStored($stored), 'theme' => $theme, 'sort' => $sort]);
            }
        }
    }
}
