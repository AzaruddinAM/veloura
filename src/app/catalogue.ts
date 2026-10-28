import { Catalogue } from './shop-api';

// Built-in copy of the catalogue, used only if the backend cannot be reached,
// so the shop never shows up empty. The live list is managed in the admin panel.
export const FALLBACK: Catalogue = {
  categories: ['Necklaces', 'Bangles', 'Sets', 'Bracelets', 'Watches'],
  products: [
    { id: 1, name: 'Blossom Vine Necklace', cat: 'Necklaces', price: 799, was: 1199, img: 'img/p1.webp', note: 'Emerald-accent AD flowers' },
    { id: 2, name: 'Emerald Serpent Bangle', cat: 'Bangles', price: 999, was: 1499, img: 'img/p2.webp', note: 'White enamel, pavé head' },
    { id: 3, name: 'Cherry Blossom Cuff', cat: 'Bangles', price: 1099, was: 1599, img: 'img/p3.webp', note: 'Openable, AD stone rails' },
    { id: 4, name: 'Hexa Edge Bangle', cat: 'Bangles', price: 699, was: 999, img: 'img/p4.webp', note: 'Rust proof, minimal shine' },
    { id: 5, name: 'Pastel Leaf Set', cat: 'Sets', price: 899, was: 1299, img: 'img/p5.webp', note: 'Pendant and studs' },
    { id: 6, name: 'Indigo Bloom Set', cat: 'Sets', price: 999, was: 1399, img: 'img/p6.webp', note: 'Enamel petals, blue AD centre' },
    { id: 7, name: 'Violet Leaf Set', cat: 'Sets', price: 899, was: 1299, img: 'img/p7.webp', note: 'Pendant and studs' },
    { id: 8, name: 'Lotus Pearl Set', cat: 'Sets', price: 1199, was: 1699, img: 'img/p8.webp', note: 'Pearl centre, enamel petals' },
    { id: 9, name: 'Golden Hour Watch', cat: 'Watches', price: 1299, was: 1899, img: 'img/p9.webp', note: 'Slim bracelet strap' },
    { id: 10, name: 'Coastal Charm Pendant', cat: 'Necklaces', price: 599, was: 899, img: 'img/p10.webp', note: 'Palm, shell and drink charms' },
    { id: 11, name: 'Pearl Shell Pendant', cat: 'Necklaces', price: 649, was: 949, img: 'img/p11.webp', note: 'Starfish with AD stones' },
    { id: 12, name: 'Twin Star Lariat', cat: 'Bracelets', price: 549, was: 799, img: 'img/p12.webp', note: 'Adjustable slider, green stars' },
  ],
};
