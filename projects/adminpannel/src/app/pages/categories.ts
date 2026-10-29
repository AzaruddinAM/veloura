import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Category, errorText } from '../core/api';
import { Toasts } from '../core/ui';

@Component({
  selector: 'adm-categories',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div><h1>Categories</h1><p>These are the filter buttons above the collection. Lower order shows first; empty categories are hidden on the website.</p></div>
    </div>

    <form class="card add" (ngSubmit)="add()">
      <label class="field grow"><span>New category</span><input name="name" [(ngModel)]="name" required maxlength="60" placeholder="e.g. Earrings" /></label>
      <label class="field"><span>Order</span><input name="sort" type="number" min="0" [(ngModel)]="sort" style="width:7rem" /></label>
      <button class="btn gold" [disabled]="busy() || !name.trim()">Add category</button>
    </form>

    <section class="card">
      @if (loading()) {
        @for (i of [1, 2, 3, 4]; track i) { <div class="skel" style="height:44px;margin:.4rem 0"></div> }
      } @else if (!list().length) {
        <div class="empty"><b>No categories yet</b>Add one above, then add products to it.</div>
      } @else {
        <table class="table">
          <thead><tr><th>Name</th><th>Order</th><th class="right">Products</th><th></th></tr></thead>
          <tbody>
            @for (c of list(); track c.id) {
              <tr>
                <td data-l="Name"><input [value]="c.name" #n maxlength="60" [attr.aria-label]="'Name of ' + c.name" /></td>
                <td data-l="Order"><input type="number" min="0" [value]="c.sort" #s style="width:6rem" [attr.aria-label]="'Order of ' + c.name" /></td>
                <td data-l="Products" class="right">{{ c.products_count }}</td>
                <td class="right acts">
                  <button class="btn line sm" (click)="save(c, n.value, +s.value)" [disabled]="busy()">Save</button>
                  <button class="btn danger sm" (click)="remove(c)" [disabled]="busy() || c.products_count > 0" [title]="c.products_count ? 'Move or delete its products first' : 'Delete'">Delete</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    :host{display:grid;gap:1.2rem}
    .add{display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap}
    .add .field{margin:0}
    .add .grow{flex:1;min-width:200px}
    .acts{white-space:nowrap}
    .acts .btn+.btn{margin-left:.4rem}
    @media (max-width:760px){.acts{justify-content:flex-end!important;gap:.4rem}}
  `,
})
export class CategoriesPage {
  private api = inject(Api);
  private toasts = inject(Toasts);
  readonly list = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  name = '';
  sort: number | null = null;

  constructor() { this.load(); }

  private load() {
    this.api.categories().subscribe({
      next: l => { this.list.set(l); this.loading.set(false); },
      error: e => { this.loading.set(false); this.toasts.error(errorText(e)); },
    });
  }
  private run(req: ReturnType<Api['deleteCategory']>, done: string) {
    this.busy.set(true);
    req.subscribe({
      next: () => { this.busy.set(false); this.toasts.ok(done); this.load(); },
      error: e => { this.busy.set(false); this.toasts.error(errorText(e)); },
    });
  }

  add() {
    const name = this.name.trim();
    this.run(this.api.addCategory({ name, sort: this.sort }), `Added ${name}`);
    this.name = '';
    this.sort = null;
  }
  save(c: Category, name: string, sort: number) {
    this.run(this.api.updateCategory(c.id, { name: name.trim(), sort: sort || 0 }), 'Category saved');
  }
  remove(c: Category) {
    if (confirm(`Delete the category ${c.name}?`)) this.run(this.api.deleteCategory(c.id), `Deleted ${c.name}`);
  }
}
