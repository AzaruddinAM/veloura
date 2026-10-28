<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShopApiTest extends TestCase
{
    use RefreshDatabase;

    private function product(array $attrs = []): Product
    {
        $cat = Category::firstOrCreate(['name' => $attrs['cat'] ?? 'Sets'], ['sort' => 1]);
        unset($attrs['cat']);
        $p = new Product(['category_id' => $cat->id, 'name' => 'Lotus Pearl Set', 'note' => 'Pearl', 'price' => 1199, 'was_price' => 1699, 'is_active' => true, ...$attrs]);
        $p->image_key = 'abc123';
        $p->image_sizes = [160, 320, 480, 640];
        $p->save();

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
    }

    public function test_catalogue_cache_is_cleared_when_a_product_changes(): void
    {
        $p = $this->product();
        $this->getJson('/api/catalogue')->assertJsonPath('products.0.price', 1199);

        $p->update(['price' => 999]);

        $this->getJson('/api/catalogue')->assertJsonPath('products.0.price', 999);
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
}
