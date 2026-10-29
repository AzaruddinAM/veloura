import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Api, Category, Crop, Photo, Product, THEME_KINDS, Theme, errorText, fieldErrors } from '../core/api';
import { Toasts, inr } from '../core/ui';
import { Cropper, cropStyle } from './cropper';

/** A photo chosen for a product that is not saved yet. */
interface Pending { key: number; file: File; url: string; crop: Crop | null; theme: Theme | null; }

/** What the cropper panel is working on. */
type Editing =
  | { kind: 'pending'; key: number; src: string; initial: Crop | null }
  | { kind: 'add'; file: File; src: string }
  | { kind: 'photo'; photo: Photo; src: string; initial: Crop };

/** One tile in the photo gallery, for both saved and not-yet-saved photos. */
interface Tile { id: number; thumb: string; style: string; theme: Theme | null; pending: boolean; natW?: number; crop?: Crop | null; }

const ACCEPT = /^image\/(jpeg|png|webp|avif|gif)$/;

@Component({
  selector: 'adm-product-form',
  imports: [FormsModule, RouterLink, Cropper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p><a routerLink="/products">← All products</a></p>
    <div class="page-head">
      <div><h1>{{ editing() ? 'Edit product' : 'Add product' }}</h1>@if (editing()) { <p>{{ f.name }}</p> }</div>
    </div>

    @if (loadError()) {
      <div class="card empty"><b>Could not load this product</b>{{ loadError() }}</div>
    } @else {
      <form class="cols" (ngSubmit)="save()" #form="ngForm">
        <section class="card">
          <h2>Details</h2>
          <label class="field"><span>Name</span>
            <input name="name" [(ngModel)]="f.name" required maxlength="120" placeholder="e.g. Lotus Pearl Set" />
            @if (errs()['name']) { <small class="err">{{ errs()['name'] }}</small> }
          </label>
          <label class="field"><span>Short note</span>
            <input name="note" [(ngModel)]="f.note" maxlength="160" placeholder="e.g. Pearl centre, enamel petals" />
            <small class="hint">Shown under the name on the website.</small>
          </label>
          <div class="grid2">
            <label class="field"><span>Category</span>
              <select name="category_id" [(ngModel)]="f.category_id" required>
                <option [ngValue]="null" disabled>Choose…</option>
                @for (c of cats(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
              </select>
              @if (!cats().length) { <small class="hint">No categories yet. <a routerLink="/categories">Add one first</a>.</small> }
              @if (errs()['category_id']) { <small class="err">{{ errs()['category_id'] }}</small> }
            </label>
            <label class="field"><span>Display order</span>
              <input type="number" name="sort" [(ngModel)]="f.sort" min="0" />
              <small class="hint">Lower numbers show first.</small>
            </label>
            <label class="field"><span>Selling price (₹)</span>
              <input type="number" name="price" [(ngModel)]="f.price" required min="1" inputmode="numeric" />
              @if (errs()['price']) { <small class="err">{{ errs()['price'] }}</small> }
            </label>
            <label class="field"><span>Original price / MRP (₹)</span>
              <input type="number" name="was_price" [(ngModel)]="f.was_price" required min="1" inputmode="numeric" />
              @if (errs()['was_price']) { <small class="err">{{ errs()['was_price'] }}</small> }
              @else if (discount() > 0) { <small class="hint">Shows as {{ discount() }}% off.</small> }
              @else if (f.price && f.was_price && f.was_price < f.price) { <small class="err">MRP must be the same or higher than the selling price.</small> }
            </label>
          </div>
          <label class="row onsale">
            <span class="switch"><input type="checkbox" name="is_active" [(ngModel)]="f.is_active" /><i></i></span>
            {{ f.is_active ? 'On sale: shown on the website' : 'Hidden from the website' }}
          </label>
        </section>

        <section class="card photos">
          <div class="card-head">
            <div><h2>Photos</h2><p class="hint">The first photo is the cover. Add the piece on a light and a dark background, and "real" photos on a white box or a dark velvet box; customers can switch between them.</p></div>
          </div>

          @if (edit(); as e) {
            <div class="editor">
              <h3>{{ e.kind === 'photo' ? 'Adjust crop' : 'New photo' }}</h3>
              <adm-cropper [src]="e.src" [initial]="e.kind === 'add' ? null : e.initial" (cropChange)="crop.set($event)" />
              <p class="hint">Drag to move · slider, mouse wheel or pinch to zoom. This square is exactly what customers see.</p>
              <div class="previews" aria-label="Previews">
                <figure><div class="pv card-pv"><img [src]="e.src" alt="" [style.width.px]="nat().w" [style.transform]="preview(150)" /></div><figcaption>Product card</figcaption></figure>
                <figure><div class="pv bag-pv"><img [src]="e.src" alt="" [style.width.px]="nat().w" [style.transform]="preview(64)" /></div><figcaption>Bag</figcaption></figure>
              </div>
              <div class="themes" role="radiogroup" aria-label="Photo type">
                <span class="hint">Type</span>
                @if (e.kind !== 'photo') { <button type="button" class="chip" role="radio" [class.on]="theme() === null" [attr.aria-checked]="theme() === null" (click)="theme.set(null)">Detect light/dark</button> }
                @for (k of kinds; track k.value) {
                  <button type="button" class="chip" role="radio" [class.on]="theme() === k.value" [attr.aria-checked]="theme() === k.value" (click)="theme.set(k.value)">{{ k.label }}</button>
                }
              </div>
              <div class="row">
                <button type="button" class="btn gold sm" (click)="applyEdit()" [disabled]="busy()">{{ e.kind === 'add' ? 'Upload photo' : e.kind === 'photo' ? 'Save crop' : 'Done' }}</button>
                <button type="button" class="btn line sm" (click)="closeEdit()" [disabled]="busy()">{{ e.kind === 'pending' ? 'Close' : 'Cancel' }}</button>
              </div>
            </div>
          }

          <ul class="gallery">
            @for (t of tiles(); track t.id; let i = $index) {
              <li class="tile" [class.cover]="i === 0">
                <div class="sq">
                  @if (t.pending) { <img [src]="t.thumb" alt="" [style.width.px]="t.natW" [style.transform]="t.style" /> }
                  @else { <img class="fill" [src]="t.thumb" alt="" width="160" height="160" /> }
                  @if (i === 0) { <span class="badge">Cover</span> }
                  @if (t.pending) { <span class="badge new">Not saved</span> }
                </div>
                <div class="seg" role="radiogroup" [attr.aria-label]="'Type of photo ' + (i + 1)">
                  @for (k of kinds; track k.value) {
                    <button type="button" role="radio" [class.on]="t.theme === k.value" [attr.aria-checked]="t.theme === k.value" (click)="setTheme(t, k.value)" [disabled]="busy()">{{ k.short }}</button>
                  }
                </div>
                @if (t.pending && t.theme === null) { <small class="hint">Detected on save</small> }
                <div class="acts">
                  <button type="button" class="btn ghost sm" (click)="openCrop(t)" [disabled]="busy()">Crop</button>
                  @if (i > 0) { <button type="button" class="btn ghost sm" (click)="makeCover(t)" [disabled]="busy()">Make cover</button> }
                  <button type="button" class="btn ghost sm del" (click)="removeTile(t)" [disabled]="busy() || (!t.pending && tiles().length === 1)" [title]="!t.pending && tiles().length === 1 ? 'A product needs at least one photo' : 'Delete photo'">Delete</button>
                </div>
              </li>
            }
            @if (tiles().length < 10) {
              <li>
                <label class="add" (dragover)="$event.preventDefault()" (drop)="drop($event)">
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple (change)="pick($event)" hidden />
                  <b>+ Add photo</b><span>JPG, PNG or WebP, up to 8 MB. You can drop files here.</span>
                </label>
              </li>
            }
          </ul>
          @for (k of photoErrors(); track k) { <small class="err">{{ k }}</small> }
          <p class="hint" style="margin-top:.8rem">Photos are saved as small WebP files in several sizes, so the shop loads fast.</p>
        </section>

        <div class="actions card">
          <button class="btn gold" type="submit" [disabled]="busy() || !form.valid || !tiles().length">{{ busy() ? 'Saving…' : editing() ? 'Save details' : 'Add product' }}</button>
          <a class="btn line" routerLink="/products">{{ editing() ? 'Back' : 'Cancel' }}</a>
          @if (!editing() && !tiles().length) { <span class="hint">Add at least one photo.</span> }
          @if (editing()) { <span class="hint">Photo changes are saved straight away.</span> }
          @if (editing()) { <button type="button" class="btn danger" style="margin-left:auto" (click)="remove()" [disabled]="busy()">Delete product</button> }
        </div>
      </form>
    }
  `,
  styles: `
    :host{display:block}
    .cols{display:grid;grid-template-columns:1.1fr 1fr;gap:1.2rem;align-items:start}
    @media (max-width:950px){.cols{grid-template-columns:1fr}}
    .actions{grid-column:1/-1;display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;position:sticky;bottom:.8rem;z-index:5;box-shadow:0 -8px 30px #0008}
    .onsale{margin-top:.2rem}
    .editor{border:1px solid var(--gold);border-radius:12px;padding:1rem;margin-bottom:1rem;display:grid;gap:.6rem;background:var(--panel2)}
    .previews{display:flex;gap:1.2rem;align-items:flex-end}
    figure{display:grid;gap:.3rem;justify-items:center}
    figcaption{font-size:.78rem;color:var(--muted)}
    .pv{position:relative;overflow:hidden;background:#000}
    .pv img,.sq img:not(.fill){position:absolute;left:0;top:0;max-width:none;transform-origin:0 0}
    .card-pv{width:150px;height:150px;border-radius:6px 6px 0 0}
    .bag-pv{width:64px;height:64px;border-radius:6px}
    .themes{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}
    .gallery{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.8rem}
    .tile{display:grid;gap:.4rem;align-content:start}
    .sq{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;background:#000;border:1px solid var(--line)}
    .tile.cover .sq{border-color:var(--gold)}
    .sq img.fill{width:100%;height:100%;object-fit:cover}
    .badge{position:absolute;left:.4rem;top:.4rem;background:var(--gold);color:var(--ink);font-size:.72rem;font-weight:500;padding:.05rem .5rem;border-radius:99px}
    .badge.new{left:auto;right:.4rem;background:var(--ink);color:var(--text2);border:1px solid var(--line2)}
    .seg{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line2);border:1px solid var(--line2);border-radius:10px;overflow:hidden}
    .seg button{padding:.28rem 0;font-size:.78rem;color:var(--text2);background:var(--panel)}
    .seg button.on{background:var(--gold);color:var(--ink)}
    .seg button:disabled{cursor:not-allowed}
    .acts{display:flex;flex-wrap:wrap;gap:.1rem;justify-content:center}
    .acts .btn{padding:.25rem .5rem;font-size:.82rem}
    .del:hover:not(:disabled){color:var(--bad)!important}
    .add{display:grid;place-items:center;align-content:center;gap:.3rem;text-align:center;aspect-ratio:1;border:1.5px dashed var(--line2);border-radius:10px;cursor:pointer;color:var(--muted);padding:.8rem;font-size:.8rem;transition:border-color .2s}
    .add:hover{border-color:var(--gold)}
    .add b{color:var(--gold-hi);font-weight:500;font-size:.95rem}
  `,
})
export class ProductFormPage {
  private api = inject(Api);
  private router = inject(Router);
  private toasts = inject(Toasts);
  readonly inr = inr;
  readonly kinds = THEME_KINDS;

  readonly id = input<string>();
  readonly editing = computed(() => !!this.id());
  readonly product = signal<Product | null>(null);
  readonly cats = signal<Category[]>([]);
  readonly loadError = signal('');
  readonly busy = signal(false);
  readonly errs = signal<Record<string, string>>({});
  readonly photoErrors = computed(() => Object.entries(this.errs()).filter(([k]) => k.startsWith('photo') || k === 'image' || k === 'theme' || k.startsWith('crop')).map(([, v]) => v));

  f = { name: '', note: '', category_id: null as number | null, sort: 0, price: null as number | null, was_price: null as number | null, is_active: true };

  // New product: photos wait here until "Add product".
  readonly pending = signal<Pending[]>([]);
  private nextKey = 1;
  private sizes = signal<Record<string, { w: number; h: number }>>({});

  // Cropper panel.
  readonly edit = signal<Editing | null>(null);
  readonly crop = signal<Crop | null>(null);
  readonly theme = signal<Theme | null>(null);
  readonly nat = computed(() => this.sizes()[this.edit()?.src ?? ''] ?? { w: 0, h: 0 });

  readonly tiles = computed<Tile[]>(() => {
    const saved = this.product()?.photos ?? [];
    if (this.editing()) return saved.map(p => ({ id: p.id, thumb: p.thumb, style: '', theme: p.theme, pending: false }));
    return this.pending().map(p => {
      const s = this.sizes()[p.url];
      return { id: -p.key, thumb: p.url, theme: p.theme, pending: true, natW: s?.w, crop: p.crop, style: s ? cropStyle(p.crop ?? centre(s.w, s.h), s.w, s.h, 160) : '' };
    });
  });

  constructor() {
    this.api.categories().subscribe(c => {
      this.cats.set(c);
      if (!this.editing() && c.length === 1) this.f.category_id = c[0].id;
    });
    effect(() => {
      const id = this.id();
      if (!id) return;
      this.api.products().subscribe({
        next: list => {
          const p = list.find(x => x.id === +id);
          if (!p) { this.loadError.set('This product does not exist any more.'); return; }
          this.product.set(p);
          this.f = { name: p.name, note: p.note, category_id: p.category_id, sort: p.sort, price: p.price, was_price: p.was_price, is_active: p.is_active };
        },
        error: e => this.loadError.set(errorText(e)),
      });
    });
    inject(DestroyRef).onDestroy(() => this.pending().forEach(p => URL.revokeObjectURL(p.url)));
  }

  discount() {
    const { price, was_price } = this.f;
    return price && was_price && was_price > price ? Math.round((1 - price / was_price) * 100) : 0;
  }
  preview(box: number) { return cropStyle(this.crop(), this.nat().w, this.nat().h, box); }

  // ---- Choosing files ----
  pick(e: Event) {
    const input = e.target as HTMLInputElement;
    this.useFiles([...(input.files ?? [])]);
    input.value = '';
  }
  drop(e: DragEvent) {
    e.preventDefault();
    this.useFiles([...(e.dataTransfer?.files ?? [])]);
  }
  private useFiles(files: File[]) {
    const ok = files.filter(f => {
      if (!ACCEPT.test(f.type)) { this.toasts.error(`${f.name}: please choose a JPG, PNG or WebP photo.`); return false; }
      if (f.size > 8 * 1024 * 1024) { this.toasts.error(`${f.name} is larger than 8 MB.`); return false; }
      return true;
    }).slice(0, 10 - this.tiles().length);
    if (!ok.length) return;
    this.errs.update(e => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith('photo'))));

    if (this.editing()) {
      // Saved product: crop the first new photo, then upload it.
      this.openEdit({ kind: 'add', file: ok[0], src: this.url(ok[0]) }, null, null);
      return;
    }
    const added = ok.map(file => ({ key: this.nextKey++, file, url: this.url(file), crop: null, theme: null } as Pending));
    this.pending.update(l => [...l, ...added]);
    this.openEdit({ kind: 'pending', key: added[0].key, src: added[0].url, initial: null }, null, null);
  }
  private url(file: File) {
    const u = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => this.sizes.update(s => ({ ...s, [u]: { w: img.naturalWidth, h: img.naturalHeight } }));
    img.src = u;
    return u;
  }

  // ---- Cropper panel ----
  private openEdit(e: Editing, crop: Crop | null, theme: Theme | null) {
    this.edit.set(e);
    this.crop.set(crop);
    this.theme.set(theme);
    if (e.kind === 'photo') this.url0(e.src);
  }
  /** Measure a saved photo's original (for the previews). */
  private url0(src: string) {
    if (this.sizes()[src]) return;
    const img = new Image();
    img.onload = () => this.sizes.update(s => ({ ...s, [src]: { w: img.naturalWidth, h: img.naturalHeight } }));
    img.src = src;
  }
  openCrop(t: Tile) {
    if (t.pending) {
      const p = this.pending().find(x => x.key === -t.id)!;
      this.openEdit({ kind: 'pending', key: p.key, src: p.url, initial: p.crop }, p.crop, p.theme);
    } else {
      const ph = this.product()!.photos.find(x => x.id === t.id)!;
      this.openEdit({ kind: 'photo', photo: ph, src: ph.original, initial: ph.crop }, ph.crop, ph.theme);
    }
  }
  closeEdit() {
    const e = this.edit();
    if (e?.kind === 'add') URL.revokeObjectURL(e.src);
    this.edit.set(null);
  }
  applyEdit() {
    const e = this.edit();
    if (!e) return;
    const crop = this.crop();
    if (e.kind === 'pending') {
      this.pending.update(l => l.map(p => p.key === e.key ? { ...p, crop, theme: this.theme() } : p));
      // Move on to the next photo that has not been looked at yet.
      const next = this.pending().find(p => p.key > e.key && p.crop === null);
      if (next) this.openEdit({ kind: 'pending', key: next.key, src: next.url, initial: null }, null, next.theme);
      else this.edit.set(null);
      return;
    }
    const pid = this.product()!.id;
    if (e.kind === 'add') {
      const body = new FormData();
      body.append('image', e.file);
      appendCrop(body, '', crop);
      if (this.theme()) body.append('theme', this.theme()!);
      this.run(this.api.addPhoto(pid, body), 'Photo added', () => this.closeEdit());
    } else {
      this.run(this.api.updatePhoto(pid, e.photo.id, { ...(crop ? { crop } : {}), theme: this.theme() ?? e.photo.theme }), 'Photo saved', () => this.edit.set(null));
    }
  }

  // ---- Tile actions ----
  setTheme(t: Tile, theme: Theme) {
    if (t.theme === theme) return;
    if (t.pending) { this.pending.update(l => l.map(p => p.key === -t.id ? { ...p, theme } : p)); return; }
    this.run(this.api.updatePhoto(this.product()!.id, t.id, { theme }), `Marked as ${THEME_KINDS.find(k => k.value === theme)!.label.toLowerCase()}`);
  }
  makeCover(t: Tile) {
    if (t.pending) {
      this.pending.update(l => [l.find(p => p.key === -t.id)!, ...l.filter(p => p.key !== -t.id)]);
      return;
    }
    const ids = this.product()!.photos.map(p => p.id);
    this.run(this.api.orderPhotos(this.product()!.id, [t.id, ...ids.filter(i => i !== t.id)]), 'Cover changed');
  }
  removeTile(t: Tile) {
    if (t.pending) {
      const p = this.pending().find(x => x.key === -t.id);
      if (p) URL.revokeObjectURL(p.url);
      this.pending.update(l => l.filter(x => x.key !== -t.id));
      if (this.edit()?.kind === 'pending' && (this.edit() as { key: number }).key === -t.id) this.edit.set(null);
      return;
    }
    if (!confirm('Delete this photo?')) return;
    this.run(this.api.deletePhoto(this.product()!.id, t.id), 'Photo deleted');
  }

  /** Run a photo request on a saved product and show the fresh product. */
  private run(req: Observable<Product>, done: string, after?: () => void) {
    this.busy.set(true);
    this.errs.set({});
    req.subscribe({
      next: p => { this.product.set(p); this.busy.set(false); this.toasts.ok(done); after?.(); },
      error: e => { this.busy.set(false); this.errs.set(fieldErrors(e)); this.toasts.error(errorText(e)); },
    });
  }

  // ---- Save / delete product ----
  save() {
    const body = new FormData();
    const f = this.f;
    body.append('name', f.name.trim());
    body.append('note', f.note.trim());
    body.append('category_id', String(f.category_id ?? ''));
    body.append('sort', String(f.sort ?? 0));
    body.append('price', String(f.price ?? ''));
    body.append('was_price', String(f.was_price ?? ''));
    body.append('is_active', f.is_active ? '1' : '0');
    if (!this.editing()) {
      this.pending().forEach((p, i) => {
        body.append(`photos[${i}][image]`, p.file);
        appendCrop(body, `photos[${i}]`, p.crop);
        if (p.theme) body.append(`photos[${i}][theme]`, p.theme);
      });
    }

    this.busy.set(true);
    this.errs.set({});
    this.api.saveProduct(this.product()?.id ?? null, body).subscribe({
      next: p => {
        this.toasts.ok(this.editing() ? `Saved ${p.name}` : `Added ${p.name}`);
        this.router.navigate(['/products']);
      },
      error: e => {
        this.busy.set(false);
        this.errs.set(fieldErrors(e));
        this.toasts.error(errorText(e));
      },
    });
  }

  remove() {
    const p = this.product();
    if (!p || !confirm(`Delete ${p.name}? It disappears from the website. Past orders keep their details.`)) return;
    this.busy.set(true);
    this.api.deleteProduct(p.id).subscribe({
      next: () => { this.toasts.ok(`Deleted ${p.name}`); this.router.navigate(['/products']); },
      error: e => { this.busy.set(false); this.toasts.error(errorText(e)); },
    });
  }
}

function appendCrop(body: FormData, prefix: string, c: Crop | null) {
  if (!c) return;
  const k = (n: string) => prefix ? `${prefix}[crop][${n}]` : `crop[${n}]`;
  body.append(k('x'), c.x.toFixed(5));
  body.append(k('y'), c.y.toFixed(5));
  body.append(k('size'), c.size.toFixed(5));
}

/** The centre square, as the backend makes it when no crop is given. */
function centre(w: number, h: number): Crop {
  const s = Math.min(w, h);
  return { x: (w - s) / 2 / w, y: (h - s) / 2 / h, size: s / w };
}
