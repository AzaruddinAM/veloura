import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, OrderRow, STATUSES, errorText } from '../core/api';
import { STATUS_LABEL, inr, when } from '../core/ui';

@Component({
  selector: 'adm-orders',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div><h1>Orders</h1><p>{{ total() }} {{ total() === 1 ? 'order' : 'orders' }}{{ status() ? ' · ' + label[status()!] : '' }}</p></div>
    </div>

    <div class="toolbar">
      <div class="chips" role="tablist" aria-label="Filter by status">
        <button class="chip" role="tab" [class.on]="!status()" [attr.aria-selected]="!status()" (click)="go({ status: null })">All <b>{{ all() }}</b></button>
        @for (s of statuses; track s) {
          <button class="chip" role="tab" [class.on]="status() === s" [attr.aria-selected]="status() === s" (click)="go({ status: s })">{{ label[s] }} <b>{{ counts()[s] ?? 0 }}</b></button>
        }
      </div>
      <input class="grow input-search" type="search" placeholder="Search order ref, name or phone" [value]="q() ?? ''" (input)="search($any($event.target).value)" aria-label="Search orders" />
    </div>

    <section class="card">
      @if (error()) {
        <div class="empty"><b>Could not load orders</b>{{ error() }}</div>
      } @else if (loading() && !rows().length) {
        @for (i of [1, 2, 3, 4, 5]; track i) { <div class="skel" style="height:46px;margin:.4rem 0"></div> }
      } @else if (!rows().length) {
        <div class="empty"><b>No orders found</b>{{ q() || status() ? 'Try another filter or search.' : 'Orders from the website will appear here.' }}</div>
      } @else {
        <table class="table" [style.opacity]="loading() ? .5 : 1">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th class="right">Pieces</th><th class="right">Total</th><th>Status</th></tr></thead>
          <tbody>
            @for (o of rows(); track o.id) {
              <tr class="link" (click)="open(o.id)">
                <td data-l="Order"><a [routerLink]="['/orders', o.id]" (click)="$event.stopPropagation()">{{ o.ref }}</a></td>
                <td data-l="Date">{{ when(o.created_at) }}</td>
                <td data-l="Customer"><span class="cust">{{ o.customer_name || 'Via WhatsApp' }} @if (o.phone) { <span class="muted small">{{ o.phone }}</span> }</span></td>
                <td data-l="Pieces" class="right">{{ o.items_count }}</td>
                <td data-l="Total" class="right">{{ inr(o.total) }}</td>
                <td data-l="Status"><span class="pill" [class]="o.status">{{ label[o.status] }}</span></td>
              </tr>
            }
          </tbody>
        </table>
        @if (pages() > 1) {
          <nav class="pager" aria-label="Pages">
            <button class="btn line sm" [disabled]="pageNo() <= 1" (click)="go({ page: pageNo() - 1 })">‹ Previous</button>
            <span class="muted small">Page {{ pageNo() }} of {{ pages() }}</span>
            <button class="btn line sm" [disabled]="pageNo() >= pages()" (click)="go({ page: pageNo() + 1 })">Next ›</button>
          </nav>
        }
      }
    </section>
  `,
  styles: `:host{display:block} .cust{text-align:right} .cust .muted{display:block} @media (min-width:761px){.cust{text-align:left}}`,
})
export class OrdersPage {
  private api = inject(Api);
  private router = inject(Router);
  readonly inr = inr;
  readonly when = when;
  readonly label = STATUS_LABEL;
  readonly statuses = STATUSES;

  // Filters live in the URL (?status=…&q=…&page=…) so links and the back button work.
  readonly status = input<(typeof STATUSES)[number]>();
  readonly q = input<string>();
  readonly page = input<string>();
  readonly pageNo = computed(() => Math.max(1, Number(this.page()) || 1));

  readonly rows = signal<OrderRow[]>([]);
  readonly counts = signal<Partial<Record<string, number>>>({});
  readonly all = computed(() => Object.values(this.counts()).reduce((a: number, b) => a + (b ?? 0), 0));
  readonly pages = signal(1);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const params = { status: this.status(), q: this.q(), page: this.pageNo() };
      this.loading.set(true);
      this.api.orders(params).subscribe({
        next: r => {
          this.rows.set(r.data); this.counts.set(r.counts); this.pages.set(r.meta.pages); this.total.set(r.meta.total);
          this.loading.set(false); this.error.set('');
        },
        error: e => { this.error.set(errorText(e)); this.loading.set(false); },
      });
    });
  }

  go(change: { status?: string | null; q?: string | null; page?: number | null }) {
    // Changing the filter or search starts again from page 1.
    const page = 'page' in change ? change.page : null;
    this.router.navigate([], { queryParams: { ...change, page: page && page > 1 ? page : null }, queryParamsHandling: 'merge' });
  }
  search(v: string) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.go({ q: v.trim() || null }), 300);
  }
  open(id: number) { this.router.navigate(['/orders', id]); }
}
