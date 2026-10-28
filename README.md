# Veloura

Online shop for Veloura stainless steel AD jewellery.

- **Website** (this folder): Angular 21. The design is unchanged.
- **Backend** (`backend/`): Laravel 13 + MySQL. It stores products, orders and enquiries and has an admin panel.

Everything used is free and open source.

## What the backend does

| Feature | How it works |
|---|---|
| Product list | The site loads products and categories from `GET /api/catalogue`. You edit them in the admin panel, with no code changes. |
| Orders | "Order on WhatsApp" still opens WhatsApp. It also saves the order in MySQL with a reference such as `VL-MH3K9Q2A1B`, and that reference is added to the WhatsApp message. Prices and totals are always recalculated on the server. |
| Enquiries | The contact form still opens WhatsApp and also saves the message. |
| Admin panel | `/admin` on the backend: dashboard, orders (change status, add customer details), products (add, edit, hide, upload photo), categories, enquiries. |
| Backup | If the backend is down, the site falls back to the built-in product list, so it never shows up empty. |

## Why images load faster

1. **Right size for every screen.** When you upload a product photo, the backend crops it to the same centre square the site already shows. It then saves small WebP files at 160, 320, 480, 640 and 960 px. The browser downloads only the size it needs, using `srcset`.
   - Bag thumbnails: about 4 KB instead of about 50 KB.
   - Product cards: 10 to 40 KB instead of 33 to 69 KB. They look the same.
2. **Cached forever.** Each photo's folder name comes from its content, so a new photo always gets a new URL. `backend/public/.htaccess` lets browsers keep images for a year, so repeat visits don't download them again.
3. **Served as plain files.** The web server sends images straight from `backend/public/media`, without running PHP for each one.
4. **Hero photo preloaded.** `src/index.html` starts downloading the main banner image at once, instead of waiting for Angular to start.
5. **One small API call.** The product list is cached on the server, returned with ETag headers, and remembered in the browser for instant repeat visits.

This uses PHP's built-in GD extension. You don't need any paid image service or CDN.

## First-time setup (Windows)

You need **PHP 8.3+**, **Composer**, **Node.js** and **MySQL**. All are free.
For MySQL, the easiest option is [XAMPP](https://www.apachefriends.org/) (start "MySQL" in its control panel). [MySQL Community Server](https://dev.mysql.com/downloads/mysql/) also works.

1. In your `php.ini`, make sure these lines are **not** commented out (no `;` in front):
   ```
   extension=gd
   extension=pdo_mysql
   extension=fileinfo
   upload_max_filesize = 8M
   post_max_size = 10M
   ```
2. Create an empty MySQL database called `veloura`, for example in phpMyAdmin: http://localhost/phpmyadmin → New → `veloura`.
3. Set up the backend:
   ```bash
   cd backend
   composer install
   # Only if backend/.env does not exist yet:
   copy .env.example .env
   php artisan key:generate
   # Put your MySQL password in backend/.env (DB_PASSWORD=...) if you have one.
   php artisan migrate --seed          # creates tables + loads the 12 current products and photos
   php artisan admin:create you@example.com   # asks for a password (min 8 characters)
   ```
4. Install the website packages: `npm install` (in this folder).

## Running it every day

Open two terminals:

```bash
# Terminal 1: backend
cd backend
php artisan serve --port=8001

# Terminal 2: website
npm start          # or: npx ng serve --port 4300  (if port 4200 is busy)
```

- Website: http://localhost:4200 (or 4300)
- Admin panel: http://127.0.0.1:8001/admin

The backend uses port **8001** so it does not clash with other Laravel projects on 8000. `proxy.conf.json` forwards the website's `/api` calls to it.

## Tests

```bash
cd backend
php artisan test
```

## Going live

1. Upload `backend/` to any PHP + MySQL host and point the domain (for example `api.yourdomain.in`) at `backend/public`.
   - Set `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://api.yourdomain.in` and your MySQL details in `.env`.
   - Run `php artisan migrate --seed --force` and `php artisan admin:create ...` once.
   - Make sure GD is enabled on the host.
2. In `src/app/shop-api.ts`, set `API_URL` to `https://api.yourdomain.in/api`.
3. Run `npm run build` and upload `dist/veloura/browser/` to your main domain.
