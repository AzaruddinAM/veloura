<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_admin')->default(false)->after('password');
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60)->unique();
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->string('name', 120);
            $table->string('note', 160)->default('');
            // Prices are whole rupees (INR).
            $table->unsignedInteger('price');
            $table->unsignedInteger('was_price');
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'sort']);
        });

        // A product can have several photos (e.g. one on a light background, one on dark).
        // The first by `sort` is the cover shown on the card and in the bag.
        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            // Optimised squares live in public/media/products/{image_key}/{size}.webp
            $table->string('image_key', 40);
            $table->json('image_sizes');
            // Full photo kept so the square crop can be changed later: public/media/originals/{name}
            $table->string('image_original', 60);
            // The square that was cut from it, as fractions: {x, y, size}
            $table->json('image_crop');
            // 'light' or 'dark' background; detected on upload, can be changed in the admin panel.
            $table->string('theme', 10)->default('light');
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();

            $table->index(['product_id', 'sort']);
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('ref', 20)->unique();
            $table->string('customer_name', 80)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('address', 500)->nullable();
            $table->string('note', 500)->nullable();
            $table->unsignedInteger('total');
            $table->string('status', 20)->default('pending')->index();
            $table->string('channel', 20)->default('whatsapp');
            $table->string('ip', 45)->nullable();
            $table->timestamps();
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            // Snapshot of the product at order time, so later edits don't rewrite history.
            $table->string('name', 120);
            $table->unsignedInteger('price');
            $table->unsignedSmallInteger('qty');
            $table->unsignedInteger('line_total');
        });

        Schema::create('enquiries', function (Blueprint $table) {
            $table->id();
            // Set when the customer had pieces in their bag while sending the contact form.
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 80);
            $table->string('phone', 20);
            $table->text('message');
            $table->boolean('is_read')->default(false)->index();
            $table->string('ip', 45)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('enquiries');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('product_images');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_admin');
        });
    }
};
