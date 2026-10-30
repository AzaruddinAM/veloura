<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pieces in stock per product. Orders cannot ask for more than this, and placing
     * an order takes the pieces out of stock (cancelling puts them back).
     * null = stock not tracked for this product (no limit).
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('stock')->nullable()->after('was_price');
        });

        // Existing products start with 10 pieces; set the real numbers in the admin panel.
        DB::table('products')->update(['stock' => 10]);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('stock');
        });
    }
};
