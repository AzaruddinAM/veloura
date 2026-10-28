<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::factory()->create();
        $u->is_admin = true;
        $u->save();

        return $u;
    }

    public function test_guests_are_sent_to_login_and_non_admins_are_blocked(): void
    {
        $this->get('/admin')->assertRedirect('/admin/login');
        $this->get('/admin/login')->assertOk();

        $this->actingAs(User::factory()->create())->get('/admin')->assertForbidden();
    }

    public function test_only_admin_accounts_can_log_in(): void
    {
        User::factory()->create(['email' => 'shop@x.com', 'password' => 'secret123']);
        $this->post('/admin/login', ['email' => 'shop@x.com', 'password' => 'secret123'])->assertSessionHasErrors('email');

        $admin = $this->admin();
        $this->post('/admin/login', ['email' => $admin->email, 'password' => 'password'])->assertRedirect('/admin');
        $this->assertAuthenticatedAs($admin);
    }

    public function test_uploading_a_product_photo_creates_square_webp_sizes(): void
    {
        Storage::fake('media');
        $cat = Category::create(['name' => 'Sets']);

        $this->actingAs($this->admin())->post('/admin/products', [
            'category_id' => $cat->id, 'name' => 'Rose Set', 'note' => 'Pink AD', 'price' => 900, 'was_price' => 1200,
            'is_active' => '1', 'image' => UploadedFile::fake()->image('rose.jpg', 1200, 700),
        ])->assertRedirect('/admin/products');

        $p = Product::firstOrFail();
        $this->assertSame([160, 320, 480, 640], $p->image_sizes);
        foreach ($p->image_sizes as $s) {
            $file = Storage::disk('media')->path("products/{$p->image_key}/{$s}.webp");
            $this->assertFileExists($file);
            $this->assertSame([$s, $s, IMAGETYPE_WEBP], array_slice(getimagesize($file), 0, 3));
        }

        $this->getJson('/api/catalogue')->assertJsonPath('products.0.name', 'Rose Set');

        // Replacing the photo removes the old files; deleting the product removes the new ones.
        $oldKey = $p->image_key;
        $this->put("/admin/products/{$p->id}", [
            'category_id' => $cat->id, 'name' => 'Rose Set', 'price' => 900, 'was_price' => 1200, 'is_active' => '1',
            'image' => UploadedFile::fake()->image('new.png', 500, 500),
        ])->assertRedirect();
        $p->refresh();
        $this->assertNotSame($oldKey, $p->image_key);
        // 500 is within 10% of 480, so no extra near-duplicate file is made.
        $this->assertSame([160, 320, 480], $p->image_sizes);
        Storage::disk('media')->assertMissing("products/{$oldKey}");

        $this->delete("/admin/products/{$p->id}")->assertRedirect();
        Storage::disk('media')->assertMissing("products/{$p->image_key}");
    }

    public function test_bad_image_and_price_are_rejected(): void
    {
        Storage::fake('media');
        $cat = Category::create(['name' => 'Sets']);

        $this->actingAs($this->admin())->post('/admin/products', [
            'category_id' => $cat->id, 'name' => 'X', 'price' => 900, 'was_price' => 500,
            'image' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf'),
        ])->assertSessionHasErrors(['was_price', 'image']);
        $this->assertSame(0, Product::count());
    }

    public function test_admin_pages_render_and_order_status_updates(): void
    {
        $order = Order::create(['ref' => 'VL-TEST0001', 'total' => 500]);
        $admin = $this->admin();

        foreach (['/admin', '/admin/orders', '/admin/products', '/admin/products/create', '/admin/categories', '/admin/enquiries', "/admin/orders/{$order->id}"] as $url) {
            $this->actingAs($admin)->get($url)->assertOk();
        }

        $this->patch("/admin/orders/{$order->id}", ['status' => 'shipped', 'customer_name' => 'Asha'])->assertRedirect();
        $this->assertSame('shipped', $order->fresh()->status);

        $this->patch("/admin/orders/{$order->id}", ['status' => 'lost'])->assertSessionHasErrors('status');
    }
}
