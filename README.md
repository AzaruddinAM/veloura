# Veloura

Online shop for Veloura stainless steel AD jewellery. Three parts, all free and open source:

| Folder | What it is | Built with |
|---|---|---|
| `src/` | **Shop website** | Angular 21 |
| `projects/adminpannel/` | **Admin panel**, served at `/adminpannel` | Angular 21 (a separate app) |
| `backend/` | **API, database and image processing** | Laravel 13 + MySQL |

## Shop website

- **Products** come from the database. The site keeps a copy in the browser so repeat visits are instant, and it falls back to a built-in list if the server is down.
- **Pages:** 4 products per page on phones (swipe left or right to change page), 6 on tablets and 8 on computers.
- **Order on WhatsApp:**
  - A bar appears at the bottom once the bag has pieces. It opens WhatsApp with a numbered list:
    ```
    Hi Veloura, I would like to order:

    1. Blossom Vine Necklace — 2 × ₹799 = ₹1,598
    2. Emerald Serpent Bangle — 1 × ₹999 = ₹999

    *Total: ₹2,597* (3 pieces)
    Order ref: VL-MVS6J7TEOVOK
    ```
  - The order is saved in the admin panel under the same reference. Prices are always checked on the server.
- **Contact form:** if the bag has pieces, they are added to the WhatsApp message as the same list and saved as an order with the customer's name and phone. "Chat on WhatsApp" also includes the bag.
- **Fixes:**
  - Bag rows were stacked. They are now side by side.
  - The "added" message no longer covers the Order button on phones.
  - The bag closes with Esc, and the page behind it no longer scrolls.
  - Saved hearts survive a reload.
  - Quantity is capped at 99.
  - No "0% off" badge on items without a discount.

## Admin panel (`/adminpannel`)

- **Dashboard:** pending orders, today's orders, sales this month, unread messages, a 14-day orders chart (with a table view) and best sellers.
- **Orders:**
  - Filter by status and search by reference, name or phone.
  - On each order: change its status (Pending → Confirmed → Shipped → Delivered, or Cancelled), save the customer's address, message the customer on WhatsApp, or print.
- **Products:**
  - Add, edit, hide or show, and delete products.
  - Photo cropper: drag, zoom or pinch to choose the square customers see, with live previews. You can re-crop an existing product at any time, because the full original photo is kept.
- **Categories:** add, rename, reorder, and delete empty ones.
- **Enquiries:** contact-form messages with WhatsApp reply and call buttons, plus the bag order that came with them.
- **Settings:**
  - **Shop display:** choose which photo product cards show first: each product's cover, the light or dark studio photo, or the real photo on a white box or dark velvet box. The starting value comes from `SHOP_PHOTO_THEME` in `backend/.env` (`cover`, `light`, `dark`, `real-white` or `real-dark`); the choice in the admin panel takes priority.
  - Change your password.
- **Works on phones:** the menu slides in and tables turn into cards.
- **Pages use `#` addresses** (for example `/adminpannel/#/orders/5`). That way they work on any hosting without special server rules.

## Fast images (free)

- **Automatic resizing.** Every uploaded photo is cropped to its square and saved as WebP in 160, 320, 480, 640 and 960 px sizes, using PHP's built-in GD. Each phone or computer downloads only the size it needs.
  - Bag thumbnails: about 4 KB instead of about 50 KB.
  - Product cards: 10 to 40 KB.
- **Phone photos are turned upright automatically.** They store their rotation in EXIF data, which GD would otherwise ignore.
- **Long caching.** Image file names change whenever the photo or crop changes, so `backend/public/.htaccess` lets browsers cache them for a year.
- **Banner preloaded.** The hero photo starts downloading with the page.

## First-time setup (Windows)

You need **PHP 8.3+**, **Composer**, **Node.js** and **MySQL** (the easiest option is [XAMPP](https://www.apachefriends.org/): start "MySQL" in its control panel).

1. In `php.ini`, make sure these lines have no `;` in front:
   ```
   extension=gd
   extension=pdo_mysql
   extension=fileinfo
   upload_max_filesize = 8M
   post_max_size = 10M
   ```
2. Create an empty MySQL database called `veloura`, for example in phpMyAdmin.
3. Set up the backend:
   ```bash
   cd backend
   composer install
   # Only if backend/.env does not exist yet:
   copy .env.example .env
   php artisan key:generate
   # Put your MySQL password in backend/.env (DB_PASSWORD=...) if you have one.
   php artisan migrate --seed                  # tables + the 12 current products and photos
   php artisan admin:create you@example.com    # your admin login (asks for a password)
   ```
4. In this folder: `npm install`, then `npm run build:admin`. This builds the admin panel into `backend/public/adminpannel`.

## Running it every day

```bash
# Terminal 1: backend (also serves the admin panel)
cd backend
php artisan serve --port=8001

# Terminal 2: shop website
npm start                                  # http://localhost:4200
```

- Admin panel: http://127.0.0.1:8001/adminpannel/
- If you change the admin panel's code, use `npm run start:admin` (http://localhost:4400/adminpannel/, reloads as you edit). Run `npm run build:admin` again when you're done.

| Command | Does |
|---|---|
| `npm start` / `npm run build` | Shop website: dev server / production build in `dist/veloura` |
| `npm run start:admin` / `npm run build:admin` | Admin panel: dev server / build into `backend/public/adminpannel` |
| `cd backend && php artisan test` | Backend tests |
| `cd backend && php artisan admin:create email` | Add an admin, or reset a forgotten password |

## Going live

1. Upload `backend/` to any PHP + MySQL host and point the domain (for example `api.yourdomain.in`) at `backend/public`.
   - Set `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://api.yourdomain.in` and your MySQL details in `.env`.
   - Run `php artisan migrate --seed --force` and `php artisan admin:create ...` once.
   - GD must be enabled.
   - The admin panel is then at `https://api.yourdomain.in/adminpannel/`.
2. In `src/app/shop-api.ts`, set `API_URL` to `https://api.yourdomain.in/api`. In `projects/adminpannel/src/app/core/api.ts`, set `SITE_URL` to your shop address (used by the "View website" link).
3. Run `npm run build` and upload `dist/veloura/browser/` to your main domain. Run `npm run build:admin` and upload `backend/public/adminpannel/`.
