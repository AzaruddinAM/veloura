<?php

use App\Http\Controllers\Admin;
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

// Admin panel API (the app in /adminpannel). Bearer-token login via Sanctum.
Route::prefix('admin')->group(function () {
    // Wrong passwords are limited per email inside the controller; this only stops floods.
    Route::post('/login', [Admin\AuthController::class, 'login'])->middleware('throttle:30,1');

    Route::middleware(['auth:sanctum', 'admin'])->group(function () {
        Route::get('/me', [Admin\AuthController::class, 'me']);
        Route::post('/logout', [Admin\AuthController::class, 'logout']);
        Route::put('/password', [Admin\AuthController::class, 'password']);

        Route::get('/dashboard', Admin\DashboardController::class);
        Route::get('/counts', [Admin\DashboardController::class, 'counts']);
        Route::get('/settings', [Admin\SettingController::class, 'show']);
        Route::put('/settings', [Admin\SettingController::class, 'update']);

        Route::get('/products', [Admin\ProductController::class, 'index']);
        Route::post('/products', [Admin\ProductController::class, 'store']);
        Route::post('/products/{product}', [Admin\ProductController::class, 'update']);
        Route::patch('/products/{product}', [Admin\ProductController::class, 'patch']);
        Route::delete('/products/{product}', [Admin\ProductController::class, 'destroy']);
        Route::scopeBindings()->group(function () {
            Route::post('/products/{product}/photos', [Admin\ProductController::class, 'addPhoto']);
            Route::put('/products/{product}/photos/order', [Admin\ProductController::class, 'orderPhotos']);
            Route::patch('/products/{product}/photos/{photo}', [Admin\ProductController::class, 'updatePhoto']);
            Route::delete('/products/{product}/photos/{photo}', [Admin\ProductController::class, 'deletePhoto']);
        });

        Route::apiResource('categories', Admin\CategoryController::class)->except('show');
        Route::apiResource('orders', Admin\OrderController::class)->except('store');
        Route::apiResource('enquiries', Admin\EnquiryController::class)->only(['index', 'update', 'destroy']);
    });
});
