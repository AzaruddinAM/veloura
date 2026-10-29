<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default product photo
    |--------------------------------------------------------------------------
    |
    | Which photo the shop shows first on each product card:
    |   'cover' - each product's own cover (the first photo in the admin panel)
    |   'light' - the photo on a light background, when the product has one
    |   'dark'  - the photo on a dark background, when the product has one
    |   'real-white' - the staged photo on a white display box, when it has one
    |   'real-dark'  - the staged photo on a dark velvet box, when it has one
    |
    | This is the starting value; it can be changed any time in the admin
    | panel (Settings > Shop display), which then takes priority.
    |
    */

    'photo_theme' => env('SHOP_PHOTO_THEME', 'cover'),

];
