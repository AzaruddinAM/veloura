<?php

use App\Http\Middleware\EnsureAdmin;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['admin' => EnsureAdmin::class]);
        // Admin login happens in the /adminpannel app; the API itself answers 401.
        $middleware->redirectGuestsTo('/adminpannel/');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();

// Hostinger-style hosting: the web folder (public_html) sits next to this app folder
// instead of inside it. Use it as the public folder so the website, the admin panel
// and uploaded product photos (public/media) all live where visitors can reach them.
if (is_dir($web = dirname(__DIR__, 2).'/public_html')) {
    $app->usePublicPath($web);
}

return $app;
