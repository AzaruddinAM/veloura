<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Enquiry;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductPhoto;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminApiTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::factory()->create(['email' => 'admin@veloura.test']);
        $u->is_admin = true;
        $u->save();

        return $u;
    }

    private function product(array $attrs = []): Product
    {
        $cat = Category::firstOrCreate(['name' => 'Sets']);
        $p = Product::create(['category_id' => $cat->id, 'name' => 'Lotus', 'price' => 1000, 'was_price' => 1500, 'is_active' => true, ...$attrs]);
        $p->photos()->create(['image_key' => 'k1', 'image_sizes' => [160], 'image_original' => 'o.webp', 'image_crop' => ['x' => 0, 'y' => 0, 'size' => 1]]);

        return $p;
    }

    /** A real JPEG in one colour (Laravel's fake images are always black). */
    private function photo(string $name, int $w, int $h, array $rgb): UploadedFile
    {
        $img = imagecreatetruecolor($w, $h);
        imagefill($img, 0, 0, imagecolorallocate($img, ...$rgb));
        $path = tempnam(sys_get_temp_dir(), 'ph');
        imagejpeg($img, $path, 90);

        return new UploadedFile($path, $name, 'image/jpeg', null, true);
    }

    public function test_login_gives_a_token_only_to_admins(): void
    {
        User::factory()->create(['email' => 'shop@x.com', 'password' => 'secret123']);
        $this->postJson('/api/admin/login', ['email' => 'shop@x.com', 'password' => 'secret123'])
            ->assertUnprocessable()->assertJsonValidationErrors('email');

        $this->admin();
        $this->postJson('/api/admin/login', ['email' => 'admin@veloura.test', 'password' => 'wrong'])->assertUnprocessable();

        $token = $this->postJson('/api/admin/login', ['email' => 'admin@veloura.test', 'password' => 'password'])
            ->assertOk()->assertJsonPath('user.email', 'admin@veloura.test')->json('token');

        $this->withToken($token)->getJson('/api/admin/me')->assertOk()->assertJsonPath('email', 'admin@veloura.test');
        $this->withToken($token)->postJson('/api/admin/logout')->assertNoContent();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/admin/me')->assertUnauthorized();
    }

    public function test_only_wrong_passwords_count_towards_the_login_limit(): void
    {
        $this->admin();
        $good = ['email' => 'admin@veloura.test', 'password' => 'password'];
        for ($i = 0; $i < 8; $i++) {
            $this->postJson('/api/admin/login', $good)->assertOk();
        }
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/admin/login', [...$good, 'password' => 'bad'])->assertUnprocessable();
        }
        $this->postJson('/api/admin/login', $good)->assertStatus(429)->assertJsonPath('errors.email.0', fn ($m) => str_contains($m, 'Too many wrong attempts'));
    }

    public function test_admin_routes_need_an_admin_token(): void
    {
        foreach (['/api/admin/dashboard', '/api/admin/orders', '/api/admin/products', '/api/admin/categories', '/api/admin/enquiries'] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/admin/dashboard')->assertForbidden();
    }

    public function test_dashboard_reports_sales_and_top_products(): void
    {
        $p = $this->product();
        Order::place('VL-AAAAAA01', [['id' => $p->id, 'qty' => 2]])->update(['status' => 'confirmed']);
        Order::place('VL-AAAAAA02', [['id' => $p->id, 'qty' => 1]])->update(['status' => 'cancelled']);
        Order::place('VL-AAAAAA03', [['id' => $p->id, 'qty' => 1]]);
        Enquiry::create(['name' => 'A', 'phone' => '9999999999', 'message' => 'hello']);

        Sanctum::actingAs($this->admin());
        $res = $this->getJson('/api/admin/dashboard')->assertOk()
            ->assertJsonPath('stats.pending_orders', 1)
            ->assertJsonPath('stats.orders_today', 3)
            ->assertJsonPath('stats.sales_month', 2000)
            ->assertJsonPath('stats.unread_enquiries', 1)
            ->assertJsonPath('top_products.0', ['name' => 'Lotus', 'qty' => 3, 'total' => 3000])
            ->assertJsonCount(14, 'days')
            ->assertJsonCount(3, 'latest_orders');
        $this->assertSame(2, $res->json('days.13.orders'));
        $this->getJson('/api/admin/counts')->assertExactJson(['pending_orders' => 1, 'unread_enquiries' => 1]);
    }

    public function test_orders_can_be_filtered_searched_and_updated(): void
    {
        $p = $this->product();
        Order::place('VL-FIND0001', [['id' => $p->id, 'qty' => 1]], ['customer_name' => 'Asha']);
        Order::place('VL-OTHER001', [['id' => $p->id, 'qty' => 1]])->update(['status' => 'shipped']);
        Sanctum::actingAs($this->admin());

        $this->getJson('/api/admin/orders')->assertJsonPath('meta.total', 2)->assertJsonPath('counts.shipped', 1);
        $this->getJson('/api/admin/orders?status=shipped')->assertJsonCount(1, 'data')->assertJsonPath('data.0.ref', 'VL-OTHER001');
        $id = $this->getJson('/api/admin/orders?q=asha')->assertJsonCount(1, 'data')->json('data.0.id');

        $this->getJson("/api/admin/orders/{$id}")->assertJsonPath('items.0.name', 'Lotus')->assertJsonPath('items.0.line_total', 1000)
            ->assertJsonPath('items.0.thumb', fn ($t) => str_ends_with($t, '/k1/160.webp'));
        $this->patchJson("/api/admin/orders/{$id}", ['status' => 'delivered', 'address' => 'MG Road'])
            ->assertOk()->assertJsonPath('status', 'delivered')->assertJsonPath('address', 'MG Road');
        $this->patchJson("/api/admin/orders/{$id}", ['status' => 'lost'])->assertJsonValidationErrors('status');
        $this->deleteJson("/api/admin/orders/{$id}")->assertNoContent();
        $this->assertSame(1, Order::count());
    }

    public function test_product_with_light_and_dark_photos(): void
    {
        Storage::fake('media');
        $cat = Category::create(['name' => 'Sets']);
        Sanctum::actingAs($this->admin());
        $disk = Storage::disk('media');

        $res = $this->post('/api/admin/products', [
            'category_id' => $cat->id, 'name' => 'Rose Set', 'note' => 'Pink AD', 'price' => 900, 'was_price' => 1200, 'is_active' => '1',
            'photos' => [
                // Left 600px square of a 1200x700 cream photo.
                ['image' => $this->photo('cream.jpg', 1200, 700, [245, 235, 215]), 'crop' => ['x' => 0, 'y' => 0.1, 'size' => 0.5]],
                ['image' => $this->photo('brown.jpg', 800, 800, [40, 25, 18])],
            ],
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('name', 'Rose Set')->assertJsonCount(2, 'photos');

        $id = $res->json('id');
        // Light/dark is detected from the photo itself.
        $this->assertSame(['light', 'dark'], array_column($res->json('photos'), 'theme'));
        $cover = ProductPhoto::where('product_id', $id)->orderBy('sort')->firstOrFail();
        $this->assertSame([160, 320, 480, 600], $cover->image_sizes);
        $this->assertEquals(['x' => 0, 'y' => 0.1, 'size' => 0.5], $cover->image_crop);
        $disk->assertExists("originals/{$cover->image_original}");
        $this->assertSame([600, 600], array_slice(getimagesize($disk->path("products/{$cover->image_key}/600.webp")), 0, 2));

        // The catalogue lists both photos, cover first.
        $this->getJson('/api/catalogue')->assertJsonPath('products.0.images.0.theme', 'light')->assertJsonPath('products.0.images.1.theme', 'dark');

        // Re-crop the cover: same original, new square files, old ones removed.
        $oldKey = $cover->image_key;
        $this->patchJson("/api/admin/products/{$id}/photos/{$cover->id}", ['crop' => ['x' => 0.5, 'y' => 0, 'size' => 0.25]])->assertOk();
        $cover->refresh();
        $this->assertNotSame($oldKey, $cover->image_key);
        $this->assertSame([160, 300], $cover->image_sizes);
        $disk->assertMissing("products/{$oldKey}");
        $disk->assertExists("originals/{$cover->image_original}");

        // Relabel, add a third, reorder so the new one is the cover.
        $this->patchJson("/api/admin/products/{$id}/photos/{$cover->id}", ['theme' => 'dark'])->assertJsonPath('photos.0.theme', 'dark');
        $this->patchJson("/api/admin/products/{$id}/photos/{$cover->id}", ['theme' => 'pink'])->assertJsonValidationErrors('theme');
        $this->patchJson("/api/admin/products/{$id}/photos/{$cover->id}", ['theme' => 'real-white'])->assertJsonPath('photos.0.theme', 'real-white');
        $this->patchJson("/api/admin/products/{$id}/photos/{$cover->id}", ['theme' => 'dark'])->assertOk();
        $res = $this->post("/api/admin/products/{$id}/photos", ['image' => $this->photo('w.jpg', 500, 500, [255, 255, 255])], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonCount(3, 'photos')->assertJsonPath('photos.2.theme', 'light');
        $ids = array_column($res->json('photos'), 'id');
        $this->putJson("/api/admin/products/{$id}/photos/order", ['ids' => array_reverse($ids)])->assertJsonPath('photos.0.id', $ids[2]);
        $this->putJson("/api/admin/products/{$id}/photos/order", ['ids' => [$ids[0]]])->assertJsonValidationErrors('ids');

        // Details can be edited without touching photos.
        $this->post("/api/admin/products/{$id}", ['category_id' => $cat->id, 'name' => 'Rose Set II', 'price' => 950, 'was_price' => 1200, 'is_active' => '1'], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('name', 'Rose Set II')->assertJsonCount(3, 'photos');

        // Delete photos down to one; the last one cannot go.
        $this->deleteJson("/api/admin/products/{$id}/photos/{$ids[0]}")->assertOk()->assertJsonCount(2, 'photos');
        $this->deleteJson("/api/admin/products/{$id}/photos/{$ids[1]}")->assertOk()->assertJsonCount(1, 'photos');
        $this->deleteJson("/api/admin/products/{$id}/photos/{$ids[2]}")->assertJsonValidationErrors('photo');

        // A photo of another product is not reachable through this one.
        $other = $this->product();
        $this->deleteJson("/api/admin/products/{$id}/photos/{$other->photos()->first()->id}")->assertNotFound();

        $this->patchJson("/api/admin/products/{$id}", ['is_active' => false])->assertJsonPath('is_active', false);
        $this->getJson('/api/catalogue')->assertJsonMissing(['name' => 'Rose Set II']);

        $last = ProductPhoto::findOrFail($ids[2]);
        $this->deleteJson("/api/admin/products/{$id}")->assertNoContent();
        $disk->assertMissing("products/{$last->image_key}");
        $disk->assertMissing("originals/{$last->image_original}");
        $this->assertSame(0, ProductPhoto::where('product_id', $id)->count());
    }

    public function test_bad_product_input_is_rejected(): void
    {
        Storage::fake('media');
        $cat = Category::create(['name' => 'Sets']);
        Sanctum::actingAs($this->admin());

        $this->post('/api/admin/products', [
            'category_id' => $cat->id, 'name' => 'X', 'price' => 900, 'was_price' => 500,
            'photos' => [['image' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf'), 'crop' => ['x' => 2, 'y' => 0, 'size' => 0], 'theme' => 'pink']],
        ], ['Accept' => 'application/json'])->assertJsonValidationErrors(['was_price', 'photos.0.image', 'photos.0.crop.x', 'photos.0.crop.size', 'photos.0.theme']);

        $this->post('/api/admin/products', ['category_id' => $cat->id, 'name' => 'X', 'price' => 900, 'was_price' => 900], ['Accept' => 'application/json'])
            ->assertJsonValidationErrors('photos');
        $this->assertSame(0, Product::count());
    }

    public function test_categories_and_enquiries(): void
    {
        Sanctum::actingAs($this->admin());
        $id = $this->postJson('/api/admin/categories', ['name' => 'Rings'])->assertCreated()->json('id');
        $this->postJson('/api/admin/categories', ['name' => 'Rings'])->assertJsonValidationErrors('name');
        $this->putJson("/api/admin/categories/{$id}", ['name' => 'Toe Rings', 'sort' => 3])->assertJsonPath('name', 'Toe Rings');
        $this->product(['category_id' => $id]);
        $this->deleteJson("/api/admin/categories/{$id}")->assertJsonValidationErrors('name');

        $e = Enquiry::create(['name' => 'A', 'phone' => '9999999999', 'message' => 'hello']);
        $this->getJson('/api/admin/enquiries?unread=1')->assertJsonCount(1, 'data');
        $this->patchJson("/api/admin/enquiries/{$e->id}", ['is_read' => true])->assertNoContent();
        $this->getJson('/api/admin/enquiries?unread=1')->assertJsonCount(0, 'data');
        $this->deleteJson("/api/admin/enquiries/{$e->id}")->assertNoContent();
    }

    public function test_photo_themes_setting(): void
    {
        // Starts from config (SHOP_PHOTO_THEMES), then the admin panel takes over.
        config(['shop.photo_themes' => 'dark, real-dark']);

        Sanctum::actingAs($this->admin());
        $this->getJson('/api/admin/settings')->assertExactJson(['photo_themes' => ['dark', 'real-dark'], 'cover_theme' => 'product']);
        $this->putJson('/api/admin/settings', ['photo_themes' => ['real-white', 'light']])->assertExactJson(['photo_themes' => ['light', 'real-white'], 'cover_theme' => 'product']);
        $this->putJson('/api/admin/settings', ['photo_themes' => ['pink']])->assertJsonValidationErrors('photo_themes.0');
        $this->putJson('/api/admin/settings', ['photo_themes' => []])->assertJsonValidationErrors('photo_themes');
        $this->putJson('/api/admin/settings', ['photo_themes' => ['light', 'light']])->assertJsonValidationErrors('photo_themes.0');
        $this->getJson('/api/admin/settings')->assertExactJson(['photo_themes' => ['light', 'real-white'], 'cover_theme' => 'product']);

        // Bad values in .env are dropped; with none valid, every type is shown.
        Setting::query()->delete();
        config(['shop.photo_themes' => 'purple,dark']);
        $this->assertSame(['dark'], Setting::get('photo_themes'));
        config(['shop.photo_themes' => 'purple']);
        $this->assertSame(ProductPhoto::THEMES, Setting::get('photo_themes'));
    }

    public function test_cover_theme_setting(): void
    {
        Sanctum::actingAs($this->admin());
        $this->putJson('/api/admin/settings', ['cover_theme' => 'real-white'])->assertJsonPath('cover_theme', 'real-white');
        $this->putJson('/api/admin/settings', ['cover_theme' => 'gold'])->assertJsonValidationErrors('cover_theme');
        $this->putJson('/api/admin/settings', ['cover_theme' => ['light']])->assertJsonValidationErrors('cover_theme');
        // Saving one setting leaves the other alone.
        $this->putJson('/api/admin/settings', ['photo_themes' => ['dark']])->assertJsonPath('cover_theme', 'real-white');

        // From .env until saved; a bad value falls back to each product's own cover.
        Setting::query()->delete();
        config(['shop.cover_theme' => 'dark']);
        $this->assertSame('dark', Setting::get('cover_theme'));
        config(['shop.cover_theme' => 'purple']);
        $this->assertSame('product', Setting::get('cover_theme'));
    }

    public function test_product_can_choose_its_own_photo_themes(): void
    {
        Sanctum::actingAs($this->admin());
        $p = $this->product();
        $body = ['category_id' => $p->category_id, 'name' => 'Ring', 'price' => 100, 'was_price' => 100];

        $this->post("/api/admin/products/{$p->id}", [...$body, 'themes' => ['real-dark', 'light']], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('themes', ['light', 'real-dark']);
        $this->post("/api/admin/products/{$p->id}", [...$body, 'themes' => ['gold']], ['Accept' => 'application/json'])
            ->assertJsonValidationErrors('themes.0');
        // Nothing chosen: back to following the shop setting.
        $this->post("/api/admin/products/{$p->id}", [...$body, 'themes' => ''], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('themes', null);
    }

    public function test_password_change_requires_current_password(): void
    {
        Sanctum::actingAs($this->admin());
        $this->putJson('/api/admin/password', ['current_password' => 'nope', 'password' => 'newsecret1', 'password_confirmation' => 'newsecret1'])
            ->assertJsonValidationErrors('current_password');
    }

    public function test_admin_app_is_served(): void
    {
        $dir = public_path('adminpannel');
        $made = ! is_file("{$dir}/index.html");
        if ($made) {
            @mkdir($dir);
            file_put_contents("{$dir}/index.html", '<adm-root></adm-root>');
        }
        try {
            $this->get('/adminpannel')->assertOk();
            $this->get('/')->assertRedirect('/adminpannel');
        } finally {
            if ($made) {
                unlink("{$dir}/index.html");
                @rmdir($dir);
            }
        }
    }

    public function test_seeder_loads_the_catalogue_with_photos(): void
    {
        Storage::fake('media');
        $this->seed();

        // Every piece has light, dark, real-white and real-dark photos, except two bangles (dark ones only).
        $this->assertSame(40, Product::count());
        $this->assertSame(156, ProductPhoto::count());
        $blossom = Product::where('name', 'Blossom Vine Necklace')->firstOrFail();
        $this->assertSame(['light', 'dark', 'real-white', 'real-dark'], $blossom->photos->pluck('theme')->all());
        $this->assertSame(['dark', 'light', 'real-white', 'real-dark'], Product::where('name', 'Golden Hour Watch')->firstOrFail()->photos->pluck('theme')->all());
        $this->assertSame(['dark', 'real-dark'], Product::where('name', 'Square Crystal Bangle')->firstOrFail()->photos->pluck('theme')->all());
        $this->getJson('/api/catalogue')->assertJsonCount(40, 'products')->assertJsonCount(4, 'products.0.images')->assertJsonPath('products.0.images.2.theme', 'real-white');
    }
}
