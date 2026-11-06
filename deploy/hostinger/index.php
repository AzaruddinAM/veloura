<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Hostinger layout: this file is in public_html/, the app is in ../veloura/
// (next to public_html, out of reach of visitors).
$app_dir = __DIR__.'/../veloura';

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = $app_dir.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require $app_dir.'/vendor/autoload.php';

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once $app_dir.'/bootstrap/app.php';

$app->handleRequest(Request::capture());
