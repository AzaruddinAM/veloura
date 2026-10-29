<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Photo types can now be multi-selected: shop-wide (setting "photo_themes")
     * and per product (products.themes, null = follow the shop setting).
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // e.g. ["light","real-white"]; only these photos are shown for the product.
            $table->json('themes')->nullable()->after('sort');
        });

        // The old single "photo shown first" setting no longer applies; the shop now
        // shows every photo type until some are chosen in Settings.
        DB::table('settings')->where('key', 'photo_theme')->delete();
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('themes');
        });
        DB::table('settings')->where('key', 'photo_themes')->delete();
    }
};
