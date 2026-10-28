<?php

use App\Http\Controllers\Api\CatalogueController;
use App\Http\Controllers\Api\EnquiryController;
use App\Http\Controllers\Api\OrderController;
use Illuminate\Support\Facades\Route;

// Public storefront API, consumed by the Angular site.
Route::get('/catalogue', CatalogueController::class)
    ->middleware('cache.headers:public;max_age=120;etag');

Route::middleware('throttle:10,1')->group(function () {
    Route::post('/orders', [OrderController::class, 'store']);
    Route::post('/enquiries', [EnquiryController::class, 'store']);
});
