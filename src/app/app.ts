import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Reveal } from './reveal';

interface Product { id: number; name: string; cat: string; price: number; was: number; img: string; note: string; }
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
  readonly phones = PHONES;
  readonly cats = ['All', 'Necklaces', 'Bangles', 'Sets', 'Bracelets', 'Watches'];

  // Placeholder prices (INR) - replace with real catalogue data or an API call.
  readonly products: Product[] = [
    { id: 1, name: 'Blossom Vine Necklace', cat: 'Necklaces', price: 799, was: 1199, img: 'p1', note: 'Emerald-accent AD flowers' },
    { id: 2, name: 'Emerald Serpent Bangle', cat: 'Bangles', price: 999, was: 1499, img: 'p2', note: 'White enamel, pavé head' },
    { id: 3, name: 'Cherry Blossom Cuff', cat: 'Bangles', price: 1099, was: 1599, img: 'p3', note: 'Openable, AD stone rails' },
    { id: 4, name: 'Hexa Edge Bangle', cat: 'Bangles', price: 699, was: 999, img: 'p4', note: 'Rust proof, minimal shine' },
    { id: 5, name: 'Pastel Leaf Set', cat: 'Sets', price: 899, was: 1299, img: 'p5', note: 'Pendant and studs' },
    { id: 6, name: 'Indigo Bloom Set', cat: 'Sets', price: 999, was: 1399, img: 'p6', note: 'Enamel petals, blue AD centre' },
    { id: 7, name: 'Violet Leaf Set', cat: 'Sets', price: 899, was: 1299, img: 'p7', note: 'Pendant and studs' },
    { id: 8, name: 'Lotus Pearl Set', cat: 'Sets', price: 1199, was: 1699, img: 'p8', note: 'Pearl centre, enamel petals' },
    { id: 9, name: 'Golden Hour Watch', cat: 'Watches', price: 1299, was: 1899, img: 'p9', note: 'Slim bracelet strap' },
    { id: 10, name: 'Coastal Charm Pendant', cat: 'Necklaces', price: 599, was: 899, img: 'p10', note: 'Palm, shell and drink charms' },
    { id: 11, name: 'Pearl Shell Pendant', cat: 'Necklaces', price: 649, was: 949, img: 'p11', note: 'Starfish with AD stones' },
    { id: 12, name: 'Twin Star Lariat', cat: 'Bracelets', price: 549, was: 799, img: 'p12', note: 'Adjustable slider, green stars' },
  ];
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

  shown = computed(() => this.cat() === 'All' ? this.products : this.products.filter(p => p.cat === this.cat()));
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
  }

  private load(): Line[] {
    try {
      const v = JSON.parse(localStorage.getItem('veloura-bag') ?? '[]');
      return Array.isArray(v) ? v : [];
    } catch { return []; }
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
    const lines = this.bag().map(l => `${l.qty} x ${l.p.name} (${this.inr(l.p.price)})`).join('\n');
    const text = `Hi Veloura, I would like to order:\n${lines}\nTotal: ${this.inr(this.total())}`;
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }
  send() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(`Hi Veloura, I am ${v.name} (${v.phone}). ${v.message}`)}`, '_blank', 'noopener');
    this.sent.set(true);
    this.form.reset();
  }
  go(id: string) {
    this.menuOpen.set(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
