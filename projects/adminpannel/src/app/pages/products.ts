import { ChangeDetectionStrategy, Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, Product, errorText } from '../core/api';
import { Toasts, inr } from '../core/ui';

@Component({
  selector: 'adm-products',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:resize)': 'resized()' },
  template: `
    <div class="page-head">
      <div><h1>Products</h1><p>{{ live() }} on sale · {{ hiddenCount() }} hidden</p></div>
      <a class="btn gold" routerLink="/products/new">+ Add product</a>
    </div>

    <div class="toolbar">
      <input class="grow input-search" type="search" placeholder="Search products" [value]="q()" (input)="filter(q, $any($event.target).value)" aria-label="Search products" />
      <select [value]="cat()" (change)="filter(cat, $any($event.target).value)" aria-label="Category" style="width:auto">
        <option value="">All categories</option>
        @for (c of categories(); track c) { <option [value]="c">{{ c }}</option> }
      </select>
      <div class="chips">
        @for (s of shows; track s.v) { <button class="chip" [class.on]="show() === s.v" (click)="filter(show, s.v)">{{ s.label }}</button> }
      </div>
    </div>

    @if (error()) {
      <div class="card empty"><b>Could not load products</b>{{ error() }}</div>
    } @else if (loading()) {
      <div class="grid">@for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) { <div class="skel" style="aspect-ratio:.8"></div> }</div>
    } @else if (!shown().length) {
      <div class="card empty">
        @if (all().length) { <b>No products match</b>Try another search or filter. }
        @else { <b>No products yet</b><a routerLink="/products/new">Add your first product</a> }
      </div>
    } @else {
      <div class="grid">
        @for (p of paged(); track p.id) {
          <article class="card prod" [class.hidden]="!p.is_active">
            <a [routerLink]="['/products', p.id]" class="pic">
              @if (p.img) { <img [src]="p.img" [attr.srcset]="p.srcset" sizes="240px" [alt]="p.name" loading="lazy" width="320" height="320" /> }
              @if (p.was_price > p.price) { <span class="disc">{{ off(p) }}% off</span> }
              @if (!p.is_active) { <span class="pill off hid">Hidden</span> }
              @if (p.photos.length > 1) { <span class="count">{{ p.photos.length }} photos</span> }
            </a>
            <div class="body">
              <a [routerLink]="['/products', p.id]" class="nm">{{ p.name }}</a>
              <span class="muted small">{{ p.category }} · order {{ p.sort }}</span>
              <span class="price"><b>{{ inr(p.price) }}</b> @if (p.was_price > p.price) { <s>{{ inr(p.was_price) }}</s> }</span>
              <span class="stock" [class.low]="isLow(p)" [class.out]="p.stock === 0">{{ p.stock === null ? 'Stock not tracked' : p.stock === 0 ? 'Sold out' : p.stock + ' in stock' }}</span>
              <div class="foot">
                <label class="row small" [title]="p.is_active ? 'Shown on the website' : 'Hidden from the website'">
                  <span class="switch"><input type="checkbox" [checked]="p.is_active" (change)="toggle(p, $any($event.target).checked)" [attr.aria-label]="'Show ' + p.name + ' on the website'" /><i></i></span>
                  {{ p.is_active ? 'On sale' : 'Hidden' }}
                </label>
                <a class="btn ghost sm" [routerLink]="['/products', p.id]">Edit</a>
              </div>
            </div>
          </article>
        }
      </div>
      @if (pages() > 1) {
        <nav class="pager" aria-label="Product pages">
          <button class="btn line sm" [disabled]="page() <= 1" (click)="go(page() - 1)" aria-label="Previous page">‹</button>
          @for (n of pageList(); track n) {
            <button class="btn sm" [class.gold]="n === page()" [class.line]="n !== page()" [attr.aria-current]="n === page() ? 'page' : null" (click)="go(n)">{{ n }}</button>
          }
          <button class="btn line sm" [disabled]="page() >= pages()" (click)="go(page() + 1)" aria-label="Next page">›</button>
        </nav>
        <p class="range muted small">Showing {{ range() }} of {{ shown().length }}</p>
      }
    }
  `,
  styles: `
    :host{display:block}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:1rem}
    .prod{padding:0;overflow:hidden;display:flex;flex-direction:column;transition:border-color .2s}
    .prod:hover{border-color:var(--line2)}
    .prod.hidden .pic img{opacity:.45;filter:grayscale(.6)}
    .pic{position:relative;aspect-ratio:1;background:#000;display:block}
    .pic img{width:100%;height:100%;object-fit:cover}
    .disc{position:absolute;left:.6rem;top:.6rem;background:var(--gold);color:var(--ink);font-size:.75rem;font-weight:500;padding:.05rem .55rem;border-radius:99px}
    .hid{position:absolute;right:.6rem;top:.6rem;background:var(--ink)}
    .count{position:absolute;left:.6rem;bottom:.6rem;background:#0b0605cc;color:var(--cream);font-size:.72rem;padding:.05rem .5rem;border-radius:99px;border:1px solid var(--line2)}
    .body{padding:.8rem .9rem .9rem;display:grid;gap:.2rem;flex:1}
    .nm{color:var(--cream);font:600 1.15rem/1.2 var(--serif)}
    .price b{color:var(--gold-hi);font-weight:500}
    .price s{color:var(--muted);font-size:.85rem;margin-left:.3rem}
    .stock{font-size:.82rem;color:var(--muted)}
    .stock.low{color:var(--warn)}
    .stock.out{color:var(--bad)}
    .foot{display:flex;justify-content:space-between;align-items:center;margin-top:.5rem;padding-top:.6rem;border-top:1px solid var(--line)}
    .pager .btn{min-width:2.4rem}
    .range{text-align:center;margin-top:.5rem}
    /* Phones: two products per row, compact cards. */
    @media (max-width:760px){
      .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem}
      .body{padding:.6rem .65rem .7rem}
      .nm{font-size:1rem}
      .foot{flex-wrap:wrap;gap:.3rem}
    }
  `,
})
export class ProductsPage {
  private api = inject(Api);
  private toasts = inject(Toasts);
  readonly inr = inr;
  readonly shows = [{ v: 'all', label: 'All' }, { v: 'on', label: 'On sale' }, { v: 'off', label: 'Hidden' }, { v: 'low', label: 'Low stock' }];
  /** 3 pieces or fewer (stock tracked). */
  isLow(p: Product) { return p.stock !== null && p.stock <= 3; }

  readonly all = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly q = signal('');
  readonly cat = signal('');
  readonly show = signal('all');

  readonly categories = computed(() => [...new Set(this.all().map(p => p.category))]);
  readonly live = computed(() => this.all().filter(p => p.is_active).length);
  readonly hiddenCount = computed(() => this.all().length - this.live());
  readonly shown = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.all().filter(p =>
      (!q || p.name.toLowerCase().includes(q) || p.note.toLowerCase().includes(q)) &&
      (!this.cat() || p.category === this.cat()) &&
      (this.show() === 'all' || (this.show() === 'low' ? this.isLow(p) : (this.show() === 'on') === p.is_active)));
  });

  // Pages: 6 per page on phones (2 per row), 12 on bigger screens.
  private width = signal(window.innerWidth);
  readonly perPage = computed(() => this.width() <= 760 ? 6 : 12);
  readonly pages = computed(() => Math.max(1, Math.ceil(this.shown().length / this.perPage())));
  private wanted = signal(1);
  readonly page = computed(() => Math.min(this.wanted(), this.pages()));
  readonly paged = computed(() => this.shown().slice((this.page() - 1) * this.perPage(), this.page() * this.perPage()));
  readonly pageList = computed(() => Array.from({ length: this.pages() }, (_, i) => i + 1));
  readonly range = computed(() => {
    const from = (this.page() - 1) * this.perPage() + 1;
    return `${from}–${Math.min(from + this.perPage() - 1, this.shown().length)}`;
  });

  constructor() {
    this.api.products().subscribe({
      next: p => { this.all.set(p); this.loading.set(false); },
      error: e => { this.error.set(errorText(e)); this.loading.set(false); },
    });
  }

  resized() { this.width.set(window.innerWidth); }
  /** Changing the search or a filter starts again from page 1. */
  filter(sig: WritableSignal<string>, v: string) {
    sig.set(v);
    this.wanted.set(1);
  }
  go(n: number) {
    this.wanted.set(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  off(p: Product) { return Math.round((1 - p.price / p.was_price) * 100); }

  toggle(p: Product, on: boolean) {
    this.all.update(l => l.map(x => x.id === p.id ? { ...x, is_active: on } : x));
    this.api.patchProduct(p.id, { is_active: on }).subscribe({
      next: () => this.toasts.ok(on ? `${p.name} is on sale` : `${p.name} is hidden from the website`),
      error: e => {
        this.all.update(l => l.map(x => x.id === p.id ? { ...x, is_active: !on } : x));
        this.toasts.error(errorText(e));
      },
    });
  }
}
