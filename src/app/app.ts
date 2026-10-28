import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Reveal } from './reveal';
import { Catalogue, Product, ShopApi } from './shop-api';
import { FALLBACK } from './catalogue';

interface Line { p: Product; qty: number; }

const PHONES = [{ label: '+91 84313 60714', tel: '+918431360714' }, { label: '+91 73560 35113', tel: '+917356035113' }];
const WA = '918431360714';

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule, Reveal],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  cat = signal('All');
  bagOpen = signal(false);
  menuOpen = signal(false);
  liked = signal<Set<number>>(new Set());
  toast = signal('');
  sent = signal(false);
  bag = signal<Line[]>(this.load());

  shown = computed(() => {
    const all = this.catalogue().products;
    return this.cat() === 'All' ? all : all.filter(p => p.cat === this.cat());
  });
  count = computed(() => this.bag().reduce((n, l) => n + l.qty, 0));
  total = computed(() => this.bag().reduce((n, l) => n + l.qty * l.p.price, 0));

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^[+]?[0-9 ]{10,14}$/)]],
    message: ['', [Validators.required, Validators.minLength(5)]],
  });

  constructor() {
    effect(() => {
      try { localStorage.setItem('veloura-bag', JSON.stringify(this.bag())); } catch { /* storage unavailable */ }
    });
    this.api.catalogue().subscribe({
      next: c => {
        this.catalogue.set(c);
        try { localStorage.setItem('veloura-catalogue', JSON.stringify(c)); } catch { /* storage unavailable */ }
        // Keep the bag in step with current prices and drop pieces that were taken off sale.
        const byId = new Map(c.products.map(p => [p.id, p]));
        this.bag.update(b => b.filter(l => byId.has(l.p.id)).map(l => ({ ...l, p: byId.get(l.p.id)! })));
      },
      error: () => { if (!this.catalogue().products.length) this.catalogue.set(FALLBACK); },
    });
  }

  private load(): Line[] {
    try {
      const v = JSON.parse(localStorage.getItem('veloura-bag') ?? '[]');
      // Bags saved before the backend existed stored just 'p1' as the image.
      return Array.isArray(v) ? v.map((l: Line) => l.p.img.includes('/') ? l : { ...l, p: { ...l.p, img: `img/${l.p.img}.webp` } }) : [];
    } catch { return []; }
  }

  private cached(): Catalogue | null {
    try {
      const v = JSON.parse(localStorage.getItem('veloura-catalogue') ?? 'null');
      return v && Array.isArray(v.products) && Array.isArray(v.categories) ? v : null;
    } catch { return null; }
  }

  inr(n: number) { return '₹' + n.toLocaleString('en-IN'); }
  off(p: Product) { return Math.round((1 - p.price / p.was) * 100); }
  trackId(_: number, p: Product) { return p.id; }

  add(p: Product) {
    this.bag.update(b => b.some(l => l.p.id === p.id)
      ? b.map(l => l.p.id === p.id ? { ...l, qty: l.qty + 1 } : l)
      : [...b, { p, qty: 1 }]);
    this.say(p.name + ' added to your bag');
  }
  step(id: number, d: number) {
    this.bag.update(b => b.map(l => l.p.id === id ? { ...l, qty: l.qty + d } : l).filter(l => l.qty > 0));
  }
  like(id: number) {
    this.liked.update(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  say(m: string) {
    this.toast.set(m);
    setTimeout(() => this.toast.set(''), 2200);
  }
  checkout() {
    // The reference is made here so WhatsApp can open right away (popup blockers
    // only allow it during the click) while the order is saved in the background.
    const ref = 'VL-' + (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase();
    const lines = this.bag().map(l => `${l.qty} x ${l.p.name} (${this.inr(l.p.price)})`).join('\n');
    const text = `Hi Veloura, I would like to order:\n${lines}\nTotal: ${this.inr(this.total())}\nOrder ref: ${ref}`;
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    this.api.order(ref, this.bag().map(l => ({ id: l.p.id, qty: l.qty }))).subscribe({ error: () => { /* WhatsApp message still has the order */ } });
  }
  send() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(`Hi Veloura, I am ${v.name} (${v.phone}). ${v.message}`)}`, '_blank', 'noopener');
    this.api.enquiry(v).subscribe({ error: () => { /* WhatsApp message still has the enquiry */ } });
    this.sent.set(true);
    this.form.reset();
  }
  go(id: string) {
    this.menuOpen.set(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
