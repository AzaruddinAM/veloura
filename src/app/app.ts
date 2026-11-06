import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Reveal } from './reveal';
import { Catalogue, Pagination, Photo, PlacedOrder, Product, ShopApi } from './shop-api';
import { FALLBACK } from './catalogue';

interface Line { p: Product; qty: number; }

const PHONES = [{ label: '+91 84313 60714', tel: '+918431360714' }, { label: '+91 73560 35113', tel: '+917356035113' }];
const WA: string = '918431360714';
const MAX_QTY: number = 99;

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
  private fb: FormBuilder = inject(FormBuilder);
  private api: ShopApi = inject(ShopApi);
  readonly phones = PHONES;

  // Last catalogue seen (instant on repeat visits), refreshed from the backend on load.
  // First-time visitors see the chips straight away and the cards as soon as the API answers.
  catalogue = signal<Catalogue>(this.cached() ?? { categories: FALLBACK.categories, products: [] });
  cats = computed((): string[] => ['All', ...this.catalogue().categories]);
  readonly services = [
    { t: 'Rust-free promise', d: 'Premium stainless steel that keeps its shine through daily wear and water.' },
    { t: 'Skin-friendly finish', d: 'Light, comfortable pieces made for everyday and sensitive skin.' },
    { t: 'Gifting ready', d: 'Pick a set, tell us the occasion, and we pack it to give.' },
    { t: 'Order on call or WhatsApp', d: 'Message us the piece you like. We confirm stock and delivery in minutes.' },
  ];

  private picked = signal('All');
  // Falls back to 'All' if the chosen category disappears after a catalogue refresh.
  cat = computed((): string => this.cats().includes(this.picked()) ? this.picked() : 'All');
  bagOpen = signal(false);
  menuOpen = signal(false);
  liked = signal<Set<number>>(new Set(this.read<number[]>('veloura-liked', [])));
  // Which photo each card shows (product id -> index into its images); the cover by default.
  private shots = signal<Record<number, number>>({});
  toast = signal('');
  sent = signal(false);
  /** An order is being saved (buttons wait so it is not sent twice). */
  placing = signal(false);
  bag = signal<Line[]>(this.load());
  width = signal(typeof window === 'undefined' ? 1300 : window.innerWidth);

  shown = computed((): Product[] => {
    const all: Product[] = this.catalogue().products;
    return this.cat() === 'All' ? all : all.filter((p: Product): boolean => p.cat === this.cat());
  });

  // Pagination, set in the admin panel: numbered pages, a "View more" button, or every product at once.
  mode = computed((): Pagination => this.catalogue().pagination ?? 'pages');
  // Two rows per page for the current column count (1 col on phones, 2-3 on tablets, 4 on desktop).
  perPage = computed((): 4 | 6 | 8 => this.width() < 600 ? 4 : this.width() < 1180 ? 6 : 8);
  pages = computed((): number => this.mode() === 'all' ? 1 : Math.max(1, Math.ceil(this.shown().length / this.perPage())));
  private wanted = signal(1);
  page = computed((): number => Math.min(this.wanted(), this.pages()));
  // In "View more" mode: how many pages' worth of cards are shown so far.
  private loaded = signal(1);
  shownCount = computed((): number => Math.min(this.loaded() * this.perPage(), this.shown().length));
  hasMore = computed((): boolean => this.mode() === 'more' && this.shownCount() < this.shown().length);
  paged = computed((): Product[] => {
    const all: Product[] = this.shown();
    switch (this.mode()) {
      case 'all': return all;
      case 'more': return all.slice(0, this.shownCount());
      default: return all.slice((this.page() - 1) * this.perPage(), this.page() * this.perPage());
    }
  });
  pageList = computed((): number[] => {
    const n: number = this.pages(), p: number = this.page();
    if (n <= 7) return Array.from({ length: n }, (_: unknown, i: number): number => i + 1);
    const mid: number[] = [p - 1, p, p + 1].filter((x: number): boolean => x > 1 && x < n);
    return [1, ...(mid[0] > 2 ? [0] : []), ...mid, ...(mid[mid.length - 1] < n - 1 ? [0] : []), n]; // 0 = gap
  });
  range = computed((): string => {
    const from: number = (this.page() - 1) * this.perPage() + 1;
    return `${from}–${Math.min(from + this.perPage() - 1, this.shown().length)} of ${this.shown().length}`;
  });

  count = computed((): number => this.bag().reduce((n: number, l: Line): number => n + l.qty, 0));
  total = computed((): number => this.bag().reduce((n: number, l: Line): number => n + l.qty * l.p.price, 0));
  chatHref = computed((): string => this.bag().length
    ? this.wa(`Hi Veloura, I have a question about the pieces in my bag:\n\n${this.bagList()}`)
    : `https://wa.me/${WA}`);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^[+]?[0-9 ]{10,14}$/)]],
    message: ['', [Validators.required, Validators.minLength(5)]],
  });

  private toastTimer?: ReturnType<typeof setTimeout>;
  private touchX: number = 0;
  private touchY: number = 0;

  constructor() {
    effect((): void => this.write('veloura-bag', this.bag()));
    effect((): void => this.write('veloura-liked', [...this.liked()]));
    // Keep the page behind the bag from scrolling while it is open.
    effect((): void => { document.body.style.overflow = this.bagOpen() ? 'hidden' : ''; });

    this.loadCatalogue();
  }

  /**
   * fresh: skip the browser's cached copy (after an order was refused for stock).
   * quiet: do not announce bag changes (the refusal message already explains them).
   */
  private loadCatalogue(fresh: boolean = false, quiet: boolean = false): void {
    this.api.catalogue(fresh).subscribe({
      next: (c: Catalogue): void => {
        this.catalogue.set(c);
        this.write('veloura-catalogue', c);
        this.syncBag(c, quiet);
      },
      error: (): void => {
        if (this.catalogue().products.length) return;
        this.catalogue.set(FALLBACK);
        this.syncBag(FALLBACK);
      },
    });
  }

  /**
   * Keep the bag in step with current prices, photos and stock: drop pieces that were
   * taken off sale or sold out, and lower quantities to what is left.
   */
  private syncBag(c: Catalogue, quiet: boolean = false): void {
    const byId: Map<number, Product> = new Map(c.products.map((p: Product): [number, Product] => [p.id, p]));
    const before: Line[] = this.bag();
    const after = before
      .filter((l: Line): boolean => byId.has(l.p.id))
      .map((l: Line) => { const p: Product = byId.get(l.p.id)!; return { p, qty: Math.min(l.qty, this.maxQty(p)) }; })
      .filter((l): boolean => l.qty > 0);
    const changed: boolean = after.length !== before.length || after.some((l, i: number): boolean => l.qty !== before[i].qty);
    this.bag.set(after);
    if (changed && !quiet) this.say('Your bag was updated to match what is in stock', 4000);
  }

  private read<T>(key: string, fallback: T): T {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
  }
  private write(key: string, v: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ }
  }

  private load(): Line[] {
    const v: Line[] = this.read<Line[]>('veloura-bag', []);
    // Bags saved before the backend existed stored just 'p1' as the image.
    return Array.isArray(v) ? v.filter((l: Line): string => l?.p?.img).map((l: Line): Line => l.p.img.includes('/') ? l : { ...l, p: { ...l.p, img: `img/${l.p.img}.webp` } }) : [];
  }

  private cached(): Catalogue | null {
    const v: Catalogue | null = this.read<Catalogue | null>('veloura-catalogue', null);
    return v && Array.isArray(v.products) && Array.isArray(v.categories) ? v : null;
  }

  inr(n: number): string { return '₹' + n.toLocaleString('en-IN'); }
  off(p: Product): number { return Math.round((1 - p.price / p.was) * 100); }

  /** Photo a card shows: the customer's pick, else the first one (the server only sends the chosen photo types). */
  shotOf(p: Product): number {
    return Math.max(0, Math.min(this.shots()[p.id] ?? 0, (p.images?.length ?? 1) - 1));
  }
  photo(p: Product): Photo { return p.images?.[this.shotOf(p)] ?? p; }
  themeName(t: string): string {
    return ({ light: 'light background', dark: 'dark background', 'real-white': 'on a white box', 'real-dark': 'on a dark velvet box' } as Record<string, string>)[t] ?? t;
  }
  show(p: Product, k: number): void { this.shots.update((s: Record<number, number>) => ({ ...s, [p.id]: k })); }

  resized(): void { this.width.set(window.innerWidth); }
  pick(c: string): void {
    this.picked.set(c);
    this.wanted.set(1);
    this.loaded.set(1);
  }
  viewMore(): void { if (this.hasMore()) this.loaded.update((n: number): number => n + 1); }
  goPage(n: number): void {
    if (n < 1 || n > this.pages() || n === this.page()) return;
    this.wanted.set(n);
    this.go('shop');
  }
  // Swipe left/right on the product grid to change page (phones).
  touchStart(e: TouchEvent): void {
    this.touchX = e.changedTouches[0].clientX;
    this.touchY = e.changedTouches[0].clientY;
  }
  touchEnd(e: TouchEvent): void {
    const dx: number = e.changedTouches[0].clientX - this.touchX;
    const dy: number = e.changedTouches[0].clientY - this.touchY;
    if (this.mode() === 'pages' && Math.abs(dx) > 60 &&Math.abs(dx) > Math.abs(dy) * 1.5) this.goPage(this.page() + (dx < 0 ? 1 : -1));
  }

  /** Most pieces of one product a customer can order: what is in stock, at most 99. */
  maxQty(p: Product): number { return Math.min(MAX_QTY, p.stock ?? MAX_QTY); }
  /** "Only N left" for products with 3 or fewer pieces. */
  left(p: Product): number { return p.stock != null && p.stock > 0 && p.stock <= 3 ? p.stock : 0; }
  private limitText(p: Product): string {
    if (p.stock === 0) return `${p.name} is sold out`;
    return p.stock != null && p.stock < MAX_QTY ? `Only ${p.stock} of ${p.name} in stock` : `You can order up to ${MAX_QTY} of one piece`;
  }

  add(p: Product): void {
    const line: Line | undefined = this.bag().find((l: Line): boolean => l.p.id === p.id);
    if ((line?.qty ?? 0) >= this.maxQty(p)) { this.say(this.limitText(p)); return; }
    this.bag.update((b: Line[]): Line[] => line ? b.map((l: Line): Line => l.p.id === p.id ? { ...l, qty: l.qty + 1 } : l) : [...b, { p, qty: 1 }]);
    this.say(p.name + ' added to your bag');
  }
  step(id: number, d: number): void {
    const line: Line | undefined = this.bag().find((l: Line): boolean => l.p.id === id);
    if (!line) return;
    if (d > 0 && line.qty >= this.maxQty(line.p)) { this.say(this.limitText(line.p)); return; }
    this.bag.update((b: Line[]): Line[] => b.map((l: Line): Line => l.p.id === id ? { ...l, qty: l.qty + d } : l).filter((l: Line): boolean => l.qty > 0));
  }
  like(id: number): void {
    this.liked.update((s: Set<number>): Set<number> => { const n: Set<number> = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  say(m: string, ms: number = 2200): void {
    clearTimeout(this.toastTimer);
    this.toast.set(m);
    this.toastTimer = setTimeout((): void => this.toast.set(''), ms);
  }

  /** The bag as a numbered list for WhatsApp, e.g. "1. Lotus Pearl Set — 2 × ₹1,199 = ₹2,398". */
  private bagList(): string {
    const lines: string[] = this.bag().map((l: Line, i: number): string => `${i + 1}. ${l.p.name} — ${l.qty} × ${this.inr(l.p.price)} = ${this.inr(l.qty * l.p.price)}`);
    const n: number = this.count();
    return `${lines.join('\n')}\n\n*Total: ${this.inr(this.total())}* (${n} ${n === 1 ? 'piece' : 'pieces'})`;
  }
  /** The saved order as a numbered list, with the server's prices and total. */
  private orderList(o: PlacedOrder): string {
    const lines: string[] = o.items.map((l, i: number): string => `${i + 1}. ${l.name} — ${l.qty} × ${this.inr(l.price)} = ${this.inr(l.line_total)}`);
    const n: number = o.items.reduce((s: number, l): number => s + l.qty, 0);
    return `${lines.join('\n')}\n\n*Total: ${this.inr(o.total)}* (${n} ${n === 1 ? 'piece' : 'pieces'})`;
  }
  private wa(text: string): string {
    return `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
  }
  private items() {
    return this.bag().map((l: Line) => ({ id: l.p.id, qty: l.qty }));
  }

  /**
   * Open a tab during the click (pop-up blockers only allow that) showing
   * "Placing your order…"; it goes to WhatsApp once the server has saved the order.
   */
  private waitingTab(): Window | null {
    const w: Window | null = window.open('', '_blank');
    try {
      if (w) {
        w.document.title = 'Veloura';
        w.document.body.style.cssText = 'font:16px system-ui,sans-serif;padding:2rem;background:#0b0605;color:#f7efe2';
        w.document.body.textContent = 'Placing your order…';
      }
    } catch { /* not allowed to write into it: it still works as the WhatsApp tab */ }
    return w;
  }
  private openWhatsApp(w: Window | null, text: string): void {
    const url: string = this.wa(text);
    if (w && !w.closed) {
      try { w.opener = null; } catch { /* ignore */ }
      w.location.href = url;
    } else {
      window.location.href = url; // pop-ups blocked: use this tab
    }
  }
  /** The server's reason when it refused the order (e.g. "Only 2 left of Lotus Pearl Set."), else null. */
  private refusal(e: HttpErrorResponse): string | null {
    if (e.status !== 422) return null;
    const errors: Record<string, string[]> | undefined = e.error?.errors as Record<string, string[]> | undefined;
    return Object.values(errors ?? {})[0]?.[0] ?? 'Please check your bag and try again.';
  }

  checkout(): void {
    if (!this.bag().length || this.placing()) return;
    const tab: Window | null = this.waitingTab();
    this.placing.set(true);
    this.api.order(this.items()).subscribe({
      next: (o: PlacedOrder): void => {
        this.placing.set(false);
        this.openWhatsApp(tab, `Hi Veloura, I would like to order:\n\n${this.orderList(o)}\nOrder ref: ${o.ref}`);
        // The pieces are now reserved for this order; an empty bag stops a second, duplicate order.
        this.bag.set([]);
        this.bagOpen.set(false);
        this.say(`Order ${o.ref} placed. Finish it on WhatsApp.`, 5000);
        this.loadCatalogue(true);
      },
      error: (e: HttpErrorResponse): void => {
        this.placing.set(false);
        const why: string | null = this.refusal(e);
        if (why) {
          tab?.close();
          this.say(why, 5000);
          this.loadCatalogue(true, true); // brings the bag back in line with the stock
          return;
        }
        // The shop's server cannot be reached: still let the customer order on WhatsApp.
        this.openWhatsApp(tab, `Hi Veloura, I would like to order:\n\n${this.bagList()}`);
      },
    });
  }
  send(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.placing()) return;
    const v = this.form.getRawValue();
    const withBag: boolean = this.bag().length > 0;
    const tab: Window | null = this.waitingTab();
    this.placing.set(true);
    this.api.enquiry({ ...v, ...(withBag ? { items: this.items() } : {}) }).subscribe({
      next: (r): void => {
        this.placing.set(false);
        let text: string = `Hi Veloura, I am ${v.name} (${v.phone}).\n${v.message}`;
        if (r.ref && r.items) {
          text += `\n\nPieces in my bag:\n${this.orderList(r as PlacedOrder)}\nOrder ref: ${r.ref}`;
          this.bag.set([]);
          this.loadCatalogue(true);
        }
        this.openWhatsApp(tab, text);
        this.sent.set(true);
        this.form.reset();
      },
      error: (e: HttpErrorResponse): void => {
        this.placing.set(false);
        const why: string | null = this.refusal(e);
        if (why) {
          tab?.close();
          this.say(why, 5000);
          this.loadCatalogue(true, true);
          return;
        }
        let text: string = `Hi Veloura, I am ${v.name} (${v.phone}).\n${v.message}`;
        if (withBag) text += `\n\nPieces in my bag:\n${this.bagList()}`;
        this.openWhatsApp(tab, text);
        this.sent.set(true);
        this.form.reset();
      },
    });
  }
  go(id: string): void {
    this.menuOpen.set(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
