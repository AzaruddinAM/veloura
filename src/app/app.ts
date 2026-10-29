import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Reveal } from './reveal';
import { Catalogue, Photo, Product, ShopApi } from './shop-api';
import { FALLBACK } from './catalogue';

interface Line { p: Product; qty: number; }

const PHONES = [{ label: '+91 84313 60714', tel: '+918431360714' }, { label: '+91 73560 35113', tel: '+917356035113' }];
const WA = '918431360714';
const MAX_QTY = 99;

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule, Reveal],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.has-bar]': 'count() > 0',
    '(window:resize)': 'resized()',
    '(document:keydown.escape)': 'bagOpen.set(false); menuOpen.set(false)',
  },
})
export class App {
  private fb = inject(FormBuilder);
  private api = inject(ShopApi);
  readonly phones = PHONES;

  // Last catalogue seen (instant on repeat visits), refreshed from the backend on load.
  // First-time visitors see the chips straight away and the cards as soon as the API answers.
  catalogue = signal<Catalogue>(this.cached() ?? { categories: FALLBACK.categories, products: [] });
  cats = computed(() => ['All', ...this.catalogue().categories]);
  readonly services = [
    { t: 'Rust-free promise', d: 'Premium stainless steel that keeps its shine through daily wear and water.' },
    { t: 'Skin-friendly finish', d: 'Light, comfortable pieces made for everyday and sensitive skin.' },
    { t: 'Gifting ready', d: 'Pick a set, tell us the occasion, and we pack it to give.' },
    { t: 'Order on call or WhatsApp', d: 'Message us the piece you like. We confirm stock and delivery in minutes.' },
  ];

  private picked = signal('All');
  // Falls back to 'All' if the chosen category disappears after a catalogue refresh.
  cat = computed(() => this.cats().includes(this.picked()) ? this.picked() : 'All');
  bagOpen = signal(false);
  menuOpen = signal(false);
  liked = signal<Set<number>>(new Set(this.read<number[]>('veloura-liked', [])));
  // Which photo each card shows (product id -> index into its images); the cover by default.
  private shots = signal<Record<number, number>>({});
  toast = signal('');
  sent = signal(false);
  bag = signal<Line[]>(this.load());
  width = signal(typeof window === 'undefined' ? 1300 : window.innerWidth);

  shown = computed(() => {
    const all = this.catalogue().products;
    return this.cat() === 'All' ? all : all.filter(p => p.cat === this.cat());
  });

  // Pagination: two rows per page for the current column count (1 col on phones, 2-3 on tablets, 4 on desktop).
  perPage = computed(() => this.width() < 600 ? 4 : this.width() < 1180 ? 6 : 8);
  pages = computed(() => Math.max(1, Math.ceil(this.shown().length / this.perPage())));
  private wanted = signal(1);
  page = computed(() => Math.min(this.wanted(), this.pages()));
  paged = computed(() => this.shown().slice((this.page() - 1) * this.perPage(), this.page() * this.perPage()));
  pageList = computed(() => {
    const n = this.pages(), p = this.page();
    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
    const mid = [p - 1, p, p + 1].filter(x => x > 1 && x < n);
    return [1, ...(mid[0] > 2 ? [0] : []), ...mid, ...(mid[mid.length - 1] < n - 1 ? [0] : []), n]; // 0 = gap
  });
  range = computed(() => {
    const from = (this.page() - 1) * this.perPage() + 1;
    return `${from}–${Math.min(from + this.perPage() - 1, this.shown().length)} of ${this.shown().length}`;
  });

  count = computed(() => this.bag().reduce((n, l) => n + l.qty, 0));
  total = computed(() => this.bag().reduce((n, l) => n + l.qty * l.p.price, 0));
  chatHref = computed(() => this.bag().length
    ? this.wa(`Hi Veloura, I have a question about the pieces in my bag:\n\n${this.bagList()}`)
    : `https://wa.me/${WA}`);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^[+]?[0-9 ]{10,14}$/)]],
    message: ['', [Validators.required, Validators.minLength(5)]],
  });

  private toastTimer?: ReturnType<typeof setTimeout>;
  private touchX = 0;
  private touchY = 0;

  constructor() {
    effect(() => this.write('veloura-bag', this.bag()));
    effect(() => this.write('veloura-liked', [...this.liked()]));
    // Keep the page behind the bag from scrolling while it is open.
    effect(() => { document.body.style.overflow = this.bagOpen() ? 'hidden' : ''; });

    this.api.catalogue().subscribe({
      next: c => {
        this.catalogue.set(c);
        this.write('veloura-catalogue', c);
        this.syncBag(c);
      },
      error: () => {
        if (this.catalogue().products.length) return;
        this.catalogue.set(FALLBACK);
        this.syncBag(FALLBACK);
      },
    });
  }

  /** Keep the bag in step with current prices and photos; drop pieces that were taken off sale. */
  private syncBag(c: Catalogue) {
    const byId = new Map(c.products.map(p => [p.id, p]));
    this.bag.update(b => b.filter(l => byId.has(l.p.id)).map(l => ({ ...l, p: byId.get(l.p.id)! })));
  }

  private read<T>(key: string, fallback: T): T {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
  }
  private write(key: string, v: unknown) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ }
  }

  private load(): Line[] {
    const v = this.read<Line[]>('veloura-bag', []);
    // Bags saved before the backend existed stored just 'p1' as the image.
    return Array.isArray(v) ? v.filter(l => l?.p?.img).map(l => l.p.img.includes('/') ? l : { ...l, p: { ...l.p, img: `img/${l.p.img}.webp` } }) : [];
  }

  private cached(): Catalogue | null {
    const v = this.read<Catalogue | null>('veloura-catalogue', null);
    return v && Array.isArray(v.products) && Array.isArray(v.categories) ? v : null;
  }

  inr(n: number) { return '₹' + n.toLocaleString('en-IN'); }
  off(p: Product) { return Math.round((1 - p.price / p.was) * 100); }

  /** Photo a card shows: the customer's pick, else the shop's default background, else the cover. */
  shotOf(p: Product) {
    const picked = this.shots()[p.id];
    if (picked !== undefined) return Math.min(picked, (p.images?.length ?? 1) - 1);
    const theme = this.catalogue().settings?.photo_theme ?? 'cover';
    const match = theme === 'cover' ? -1 : p.images?.findIndex(i => i.theme === theme) ?? -1;
    return Math.max(0, match);
  }
  photo(p: Product): Photo { return p.images?.[this.shotOf(p)] ?? p; }
  themeName(t: string) {
    return ({ light: 'light background', dark: 'dark background', 'real-white': 'on a white box', 'real-dark': 'on a dark velvet box' } as Record<string, string>)[t] ?? t;
  }
  show(p: Product, k: number) { this.shots.update(s => ({ ...s, [p.id]: k })); }

  resized() { this.width.set(window.innerWidth); }
  pick(c: string) {
    this.picked.set(c);
    this.wanted.set(1);
  }
  goPage(n: number) {
    if (n < 1 || n > this.pages() || n === this.page()) return;
    this.wanted.set(n);
    this.go('shop');
  }
  // Swipe left/right on the product grid to change page (phones).
  touchStart(e: TouchEvent) {
    this.touchX = e.changedTouches[0].clientX;
    this.touchY = e.changedTouches[0].clientY;
  }
  touchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - this.touchX;
    const dy = e.changedTouches[0].clientY - this.touchY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) this.goPage(this.page() + (dx < 0 ? 1 : -1));
  }

  add(p: Product) {
    const line = this.bag().find(l => l.p.id === p.id);
    if (line && line.qty >= MAX_QTY) { this.say(`You can order up to ${MAX_QTY} of one piece`); return; }
    this.bag.update(b => line ? b.map(l => l.p.id === p.id ? { ...l, qty: l.qty + 1 } : l) : [...b, { p, qty: 1 }]);
    this.say(p.name + ' added to your bag');
  }
  step(id: number, d: number) {
    this.bag.update(b => b.map(l => l.p.id === id ? { ...l, qty: Math.min(MAX_QTY, l.qty + d) } : l).filter(l => l.qty > 0));
  }
  like(id: number) {
    this.liked.update(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  say(m: string) {
    clearTimeout(this.toastTimer);
    this.toast.set(m);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2200);
  }

  /** The bag as a numbered list for WhatsApp, e.g. "1. Lotus Pearl Set — 2 × ₹1,199 = ₹2,398". */
  private bagList() {
    const lines = this.bag().map((l, i) => `${i + 1}. ${l.p.name} — ${l.qty} × ${this.inr(l.p.price)} = ${this.inr(l.qty * l.p.price)}`);
    const n = this.count();
    return `${lines.join('\n')}\n\n*Total: ${this.inr(this.total())}* (${n} ${n === 1 ? 'piece' : 'pieces'})`;
  }
  private newRef() {
    return 'VL-' + (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase();
  }
  private wa(text: string) {
    return `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
  }
  private items() {
    return this.bag().map(l => ({ id: l.p.id, qty: l.qty }));
  }

  checkout() {
    if (!this.bag().length) return;
    // The reference is made here so WhatsApp can open right away (popup blockers
    // only allow it during the click) while the order is saved in the background.
    const ref = this.newRef();
    window.open(this.wa(`Hi Veloura, I would like to order:\n\n${this.bagList()}\nOrder ref: ${ref}`), '_blank', 'noopener');
    this.api.order(ref, this.items()).subscribe({ error: () => { /* WhatsApp message still has the order */ } });
  }
  send() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    let text = `Hi Veloura, I am ${v.name} (${v.phone}).\n${v.message}`;
    let order = {};
    if (this.bag().length) {
      const ref = this.newRef();
      text += `\n\nPieces in my bag:\n${this.bagList()}\nOrder ref: ${ref}`;
      order = { ref, items: this.items() };
    }
    window.open(this.wa(text), '_blank', 'noopener');
    this.api.enquiry({ ...v, ...order }).subscribe({ error: () => { /* WhatsApp message still has the enquiry */ } });
    this.sent.set(true);
    this.form.reset();
  }
  go(id: string) {
    this.menuOpen.set(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
