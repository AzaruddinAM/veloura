<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShopApiTest extends TestCase
{
    use RefreshDatabase;

    /** A product with a dark cover photo and a second, light one. */
    private function product(array $attrs = []): Product
    {
        $cat = Category::firstOrCreate(['name' => $attrs['cat'] ?? 'Sets'], ['sort' => 1]);
        unset($attrs['cat']);
        $p = Product::create(['category_id' => $cat->id, 'name' => 'Lotus Pearl Set', 'note' => 'Pearl', 'price' => 1199, 'was_price' => 1699, 'is_active' => true, ...$attrs]);
        $crop = ['x' => 0, 'y' => 0, 'size' => 1];
        $p->photos()->create(['image_key' => 'abc123', 'image_sizes' => [160, 320, 480, 640], 'image_original' => 'o1.webp', 'image_crop' => $crop, 'theme' => 'dark', 'sort' => 0]);
        $p->photos()->create(['image_key' => 'light1', 'image_sizes' => [160, 320], 'image_original' => 'o2.webp', 'image_crop' => $crop, 'theme' => 'light', 'sort' => 1]);

        return $p;
    }

    public function test_catalogue_lists_active_products_with_responsive_images(): void
    {
        $this->product(['name' => 'B', 'sort' => 2]);
        $this->product(['name' => 'A', 'sort' => 1, 'cat' => 'Watches']);
        $this->product(['name' => 'Hidden', 'is_active' => false, 'cat' => 'Bangles']);

        $res = $this->getJson('/api/catalogue')->assertOk()->assertHeader('ETag');

        $res->assertJsonPath('categories', ['Sets', 'Watches'])
            ->assertJsonCount(2, 'products')
            ->assertJsonPath('products.0.name', 'A')
            ->assertJsonPath('products.0.cat', 'Watches')
            ->assertJsonPath('products.0.was', 1699);

        $p = $res->json('products.0');
        $this->assertStringEndsWith('/media/products/abc123/640.webp', $p['img']);
        $this->assertStringEndsWith('/media/products/abc123/160.webp', $p['thumb']);
        $this->assertStringContainsString('/abc123/320.webp 320w', $p['srcset']);

        // Every photo is listed with its light/dark label, cover first.
        $this->assertSame(['dark', 'light'], array_column($p['images'], 'theme'));
        $this->assertStringEndsWith('/light1/320.webp', $p['images'][1]['img']);
    }

    public function test_catalogue_shows_only_the_chosen_photo_themes(): void
    {
        $p = $this->product();
        $images = fn () => array_column($this->getJson('/api/catalogue')->json('products.0.images'), 'theme');

        // Shop setting with one type: only that photo, and it becomes the card/bag photo.
        Setting::put('photo_themes', ['light']);
        $this->assertSame(['light'], $images());
        $this->assertStringEndsWith('/light1/160.webp', $this->getJson('/api/catalogue')->json('products.0.thumb'));

        Setting::put('photo_themes', ['light', 'dark']);
        $this->assertSame(['dark', 'light'], $images());

        // The product's own choice wins over the shop setting.
        $p->update(['themes' => ['dark']]);
        $this->assertSame(['dark'], $images());

        // No photo of the chosen type: the cover is shown instead of hiding the product.
        $p->update(['themes' => ['real-white']]);
        $this->assertSame(['dark'], $images());
    }

    public function test_cover_theme_puts_that_photo_first(): void
    {
        $this->product();
        $cat = fn () => $this->getJson('/api/catalogue')->json('products.0');

        // Default: the product's own cover (its first photo, here dark).
        $this->assertSame(['dark', 'light'], array_column($cat()['images'], 'theme'));

        // Cover type light: the light photo moves to the front and is the card/bag photo.
        Setting::put('cover_theme', 'light');
        $this->assertSame(['light', 'dark'], array_column($cat()['images'], 'theme'));
        $this->assertStringEndsWith('/light1/160.webp', $cat()['thumb']);

        // A cover type the product does not show leaves its own cover in place.
        Setting::put('cover_theme', 'real-white');
        $this->assertSame(['dark', 'light'], array_column($cat()['images'], 'theme'));

        // Only shown types count: with the shop on dark only, a light cover does not bring light back.
        Setting::put('cover_theme', 'light');
        Setting::put('photo_themes', ['dark']);
        $this->assertSame(['dark'], array_column($cat()['images'], 'theme'));
    }

    public function test_products_without_photos_are_not_listed(): void
    {
        Product::create(['category_id' => Category::create(['name' => 'Sets'])->id, 'name' => 'No photo', 'price' => 1, 'was_price' => 1]);
        $this->getJson('/api/catalogue')->assertJsonCount(0, 'products');
    }

    public function test_catalogue_cache_is_cleared_when_a_product_or_photo_changes(): void
    {
        $p = $this->product();
        $this->getJson('/api/catalogue')->assertJsonPath('products.0.price', 1199);

        $p->update(['price' => 999]);
        $this->getJson('/api/catalogue')->assertJsonPath('products.0.price', 999);

        $p->photos()->first()->update(['theme' => 'light']);
        $this->getJson('/api/catalogue')->assertJsonPath('products.0.images.0.theme', 'light');
    }

    public function test_catalogue_survives_a_real_serialising_cache_store(): void
    {
        config(['cache.default' => 'database']);
        $this->product();

        $this->getJson('/api/catalogue')->assertJsonPath('categories', ['Sets']);
        // Second hit is read back from the cache table.
        $this->getJson('/api/catalogue')->assertJsonPath('categories', ['Sets'])->assertJsonPath('products.0.price', 1199);
    }

    public function test_order_total_uses_database_prices_not_browser_prices(): void
    {
        $a = $this->product(['price' => 1000]);
        $b = $this->product(['name' => 'Watch', 'price' => 250]);

        $this->postJson('/api/orders', [
            'ref' => 'VL-ABC123XY',
            'items' => [['id' => $a->id, 'qty' => 2, 'price' => 1], ['id' => $b->id, 'qty' => 1]],
        ])->assertCreated()->assertJson(['ref' => 'VL-ABC123XY', 'total' => 2250]);

        $order = Order::with('items')->firstOrFail();
        $this->assertSame('pending', $order->status);
        $this->assertSame(2250, $order->total);
        $this->assertSame([2000, 250], $order->items->pluck('line_total')->all());
    }

    public function test_order_rejects_hidden_products_bad_refs_and_duplicates(): void
    {
        $hidden = $this->product(['is_active' => false]);
        $ok = $this->product(['name' => 'Ok']);

        $this->postJson('/api/orders', ['ref' => 'VL-ABC123XY', 'items' => [['id' => $hidden->id, 'qty' => 1]]])
            ->assertUnprocessable()->assertJsonValidationErrors('items.0.id');
        $this->postJson('/api/orders', ['ref' => 'nope', 'items' => [['id' => $ok->id, 'qty' => 1]]])
            ->assertUnprocessable()->assertJsonValidationErrors('ref');
        $this->postJson('/api/orders', ['ref' => 'VL-ABC123XY', 'items' => [['id' => $ok->id, 'qty' => 0]]])
            ->assertUnprocessable()->assertJsonValidationErrors('items.0.qty');

        $this->postJson('/api/orders', ['ref' => 'VL-ABC123XY', 'items' => [['id' => $ok->id, 'qty' => 1]]])->assertCreated();
        $this->postJson('/api/orders', ['ref' => 'VL-ABC123XY', 'items' => [['id' => $ok->id, 'qty' => 1]]])
            ->assertUnprocessable()->assertJsonValidationErrors('ref');
        $this->assertSame(1, Order::count());
    }

    public function test_enquiry_is_saved_and_validated(): void
    {
        $this->postJson('/api/enquiries', ['name' => 'Asha', 'phone' => '+91 98765 43210', 'message' => 'Is the lotus set in stock?'])
            ->assertCreated();
        $this->assertDatabaseHas('enquiries', ['name' => 'Asha', 'is_read' => false]);

        $this->postJson('/api/enquiries', ['name' => 'A', 'phone' => '12', 'message' => 'hi'])
            ->assertUnprocessable()->assertJsonValidationErrors(['name', 'phone', 'message']);
    }

    public function test_enquiry_with_bag_items_saves_a_linked_order_with_customer_details(): void
    {
        $p = $this->product(['price' => 700]);

        $this->postJson('/api/enquiries', [
            'name' => 'Asha', 'phone' => '9876543210', 'message' => 'Can you gift wrap?',
            'ref' => 'VL-CONTACT01', 'items' => [['id' => $p->id, 'qty' => 3]],
        ])->assertCreated()->assertJsonPath('ref', 'VL-CONTACT01');

        $order = Order::with('items')->firstOrFail();
        $this->assertSame(['Asha', '9876543210', 2100, 'contact form'], [$order->customer_name, $order->phone, $order->total, $order->channel]);
        $this->assertDatabaseHas('enquiries', ['name' => 'Asha', 'order_id' => $order->id]);

        // Items without a reference are refused, and nothing is half-saved.
        $this->postJson('/api/enquiries', ['name' => 'Ravi', 'phone' => '9876543210', 'message' => 'Hello there', 'items' => [['id' => $p->id, 'qty' => 1]]])
            ->assertJsonValidationErrors('ref');
        $this->postJson('/api/enquiries', ['name' => 'Ravi', 'phone' => '9876543210', 'message' => 'Hello there', 'ref' => 'VL-CONTACT02', 'items' => [['id' => 999, 'qty' => 1]]])
            ->assertJsonValidationErrors('items.0.id');
        $this->assertDatabaseMissing('enquiries', ['name' => 'Ravi']);
    }
}
