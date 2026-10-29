<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Product photos shown in the shop
    |--------------------------------------------------------------------------
    |
    | Which types of photo the shop shows, comma-separated (one or more):
    |   'light'      - the studio photo on a light background
    |   'dark'       - the studio photo on a dark background
    |   'real-white' - the staged photo on a white display box
    |   'real-dark'  - the staged photo on a dark velvet box
    |
    | With one type, cards show only that photo. With several, customers can
    | switch between them. A product with none of the chosen types shows its
    | cover. Each product can also choose its own types in the admin panel.
    |
    | This is the starting value; it can be changed any time in the admin
    | panel (Settings > Shop display), which then takes priority.
    |
    */

    'photo_themes' => env('SHOP_PHOTO_THEMES', 'light,dark,real-white,real-dark'),

    /*
    |--------------------------------------------------------------------------
    | Cover photo
    |--------------------------------------------------------------------------
    |
    | Which photo type is the cover: the photo each card shows first, also used
    | in the bag. 'product' keeps each product's own cover (its first photo);
    | 'light', 'dark', 'real-white' or 'real-dark' puts that type first for every
    | product that shows it. Can be changed in the admin panel (Settings).
    |
    */

    'cover_theme' => env('SHOP_COVER_THEME', 'product'),

];
