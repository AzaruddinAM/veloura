<?php

use Illuminate\Support\Facades\Route;

Route::redirect('/', '/adminpannel/');

// The admin panel is a separate Angular app built into public/adminpannel (npm run build:admin).
// Its pages use hash URLs (/adminpannel/#/orders/5), so the server only ever has to return
// index.html. Web servers do that for /adminpannel/ by themselves; this route covers
// /adminpannel without the trailing slash and any stray path under it.
Route::get('/adminpannel/{path?}', function () {
    $index = public_path('adminpannel/index.html');
    abort_unless(is_file($index), 404, 'Admin panel is not built yet. Run: npm run build:admin');

    return response()->file($index, ['Cache-Control' => 'no-cache']);
})->where('path', '.*');
