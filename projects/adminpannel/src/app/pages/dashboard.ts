import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, Dashboard, errorText } from '../core/api';
import { STATUS_LABEL, inr, when } from '../core/ui';

@Component({
  selector: 'adm-dashboard',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div><h1>Dashboard</h1><p>{{ today }}</p></div>
      <a class="btn gold" routerLink="/products/new">+ Add product</a>
    </div>

    @if (error()) { <div class="card empty"><b>Could not load the dashboard</b>{{ error() }} <button class="btn line sm" (click)="load()">Try again</button></div> }

    <section class="tiles">
      @for (t of tiles(); track t.label) {
        <a class="card tile" [routerLink]="t.link" [queryParams]="t.query">
          <span class="label">{{ t.label }}</span>
          @if (d()) { <span class="value">{{ t.value }}</span> } @else { <span class="skel" style="height:2.2rem;width:60%"></span> }
          <span class="sub">{{ t.sub }}</span>
        </a>
      }
    </section>

    <div class="cols">
      <section class="card chart-card">
        <div class="card-head">
          <div><h2>Orders, last 14 days</h2><p class="muted small">Cancelled orders are not counted. Hover a day for details.</p></div>
          <button class="btn ghost sm" (click)="asTable.set(!asTable())" [attr.aria-pressed]="asTable()">{{ asTable() ? 'Show chart' : 'Show table' }}</button>
        </div>
        @if (!d()) {
          <div class="skel" style="height:220px"></div>
        } @else if (asTable()) {
          <table class="table">
            <thead><tr><th>Day</th><th class="right">Orders</th><th class="right">Value</th></tr></thead>
            <tbody>
              @for (day of d()!.days; track day.date) {
                <tr><td data-l="Day">{{ day.label }}</td><td data-l="Orders" class="right">{{ day.orders }}</td><td data-l="Value" class="right">{{ inr(day.total) }}</td></tr>
              }
            </tbody>
          </table>
        } @else {
          <div class="chart" role="img" [attr.aria-label]="chartLabel()">
            <div class="yaxis" aria-hidden="true">
              @for (t of ticks(); track t) { <span [style.bottom.%]="t / max() * 100">{{ t }}</span> }
            </div>
            <div class="plot">
              @for (t of ticks(); track t) { <i class="grid" [style.bottom.%]="t / max() * 100"></i> }
              @for (day of d()!.days; track day.date; let i = $index) {
                <button class="col" (mouseenter)="hover.set(i)" (mouseleave)="hover.set(-1)" (focus)="hover.set(i)" (blur)="hover.set(-1)"
                        [attr.aria-label]="day.label + ': ' + day.orders + ' orders, ' + inr(day.total)">
                  <span class="bar" [class.zero]="!day.orders" [style.height.%]="day.orders / max() * 100"></span>
                  @if (i === peak() && day.orders) { <span class="cap" [style.bottom.%]="day.orders / max() * 100">{{ day.orders }}</span> }
                  @if (hover() === i) {
                    <span class="tip" [class.left]="i > 9"><b>{{ day.label }}</b>{{ day.orders }} {{ day.orders === 1 ? 'order' : 'orders' }}<br />{{ inr(day.total) }}</span>
                  }
                </button>
              }
            </div>
            <div class="xaxis" aria-hidden="true">
              @for (day of d()!.days; track day.date; let i = $index) { <span>{{ i % 2 === 1 || i === 13 ? day.label : '' }}</span> }
            </div>
          </div>
        }
      </section>

      <section class="card">
        <h2>Best sellers</h2>
        <p class="muted small" style="margin:-.6rem 0 .8rem">Last 90 days, by pieces</p>
        @if (!d()) {
          <div class="skel" style="height:180px"></div>
        } @else if (!d()!.top_products.length) {
          <div class="empty"><b>No sales yet</b>They will show here once orders come in.</div>
        } @else {
          <ol class="top">
            @for (p of d()!.top_products; track p.name) {
              <li>
                <span class="name">{{ p.name }}</span>
                <span class="meter"><i [style.width.%]="p.qty / d()!.top_products[0].qty * 100"></i></span>
                <span class="qty">{{ p.qty }} {{ p.qty === 1 ? 'piece' : 'pieces' }} · {{ inr(p.total) }}</span>
              </li>
            }
          </ol>
        }
      </section>
    </div>

    <section class="card">
      <div class="card-head"><h2>Latest orders</h2><a routerLink="/orders" class="small">See all orders →</a></div>
      @if (!d()) {
        <div class="skel" style="height:160px"></div>
      } @else if (!d()!.latest_orders.length) {
        <div class="empty"><b>No orders yet</b>Orders placed from the website appear here.</div>
      } @else {
        <table class="table">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th class="right">Total</th><th>Status</th></tr></thead>
          <tbody>
            @for (o of d()!.latest_orders; track o.id) {
              <tr class="link" (click)="open(o.id)">
                <td data-l="Order"><a [routerLink]="['/orders', o.id]" (click)="$event.stopPropagation()">{{ o.ref }}</a></td>
                <td data-l="Date">{{ when(o.created_at) }}</td>
                <td data-l="Customer">{{ o.customer_name || 'Via WhatsApp' }}</td>
                <td data-l="Total" class="right">{{ inr(o.total) }}</td>
                <td data-l="Status"><span class="pill" [class]="o.status">{{ label[o.status] }}</span></td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    :host{display:grid;gap:1.2rem}
    .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:1rem}
    .tile{display:grid;gap:.25rem;text-decoration:none!important;color:inherit;transition:border-color .2s,transform .2s}
    .tile:hover{border-color:var(--gold);transform:translateY(-2px)}
    .label{color:var(--muted);font-size:.85rem}
    .value{font:600 2.2rem/1.1 var(--serif);color:var(--cream);font-variant-numeric:lining-nums tabular-nums}
    .sub{color:var(--muted);font-size:.8rem}
    .cols{display:grid;grid-template-columns:1.6fr 1fr;gap:1.2rem}
    @media (max-width:1000px){.cols{grid-template-columns:1fr}}

    /* Column chart: one series, bars <= 24px with 4px rounded tops on one baseline. */
    .chart{display:grid;grid-template-columns:2rem 1fr;grid-template-rows:220px auto;column-gap:.4rem}
    .yaxis{position:relative}
    .yaxis span{position:absolute;right:0;transform:translateY(50%);font-size:.75rem;color:var(--muted)}
    .plot{position:relative;display:grid;grid-template-columns:repeat(14,1fr);align-items:end;border-bottom:1px solid var(--line2)}
    .grid{position:absolute;left:0;right:0;height:1px;background:var(--line)}
    .col{position:relative;height:100%;display:flex;align-items:flex-end;justify-content:center}
    .bar{width:min(24px,70%);background:var(--gold-mark);border-radius:4px 4px 0 0;transition:background .15s;min-height:0}
    .bar.zero{height:2px!important;background:var(--line2);border-radius:0}
    .col:hover .bar:not(.zero),.col:focus-visible .bar:not(.zero){background:var(--gold)}
    .cap{position:absolute;transform:translateY(-1.3rem);font-size:.78rem;color:var(--text2)}
    .tip{position:absolute;top:0;left:50%;z-index:5;width:max-content;background:var(--ink);border:1px solid var(--line2);border-radius:8px;padding:.45rem .65rem;font-size:.82rem;text-align:left;color:var(--text2);box-shadow:0 8px 20px #000a;pointer-events:none}
    .tip.left{left:auto;right:50%}
    .tip b{display:block;color:var(--cream);font-weight:500}
    .xaxis{grid-column:2;display:grid;grid-template-columns:repeat(14,1fr);margin-top:.4rem}
    .xaxis span{font-size:.72rem;color:var(--muted);text-align:center;white-space:nowrap}

    .top{list-style:none;padding:0;display:grid;gap:.9rem}
    .top li{display:grid;grid-template-columns:1fr auto;gap:.3rem .8rem}
    .name{font-weight:500}
    .qty{grid-row:1;grid-column:2;color:var(--muted);font-size:.85rem;text-align:right}
    .meter{grid-column:1/-1;height:6px;border-radius:99px;background:var(--line)}
    .meter i{display:block;height:100%;border-radius:99px;background:var(--gold-mark)}
  `,
})
export class DashboardPage {
  private api = inject(Api);
  private router = inject(Router);
  readonly inr = inr;
  readonly when = when;
  readonly label = STATUS_LABEL;
  readonly today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  readonly d = signal<Dashboard | null>(null);
  readonly error = signal('');
  readonly hover = signal(-1);
  readonly asTable = signal(false);

  readonly tiles = computed(() => {
    const s = this.d()?.stats;
    return [
      { label: 'Pending orders', value: s?.pending_orders ?? 0, sub: 'Waiting for you to confirm', link: '/orders', query: { status: 'pending' } },
      { label: 'Orders today', value: s?.orders_today ?? 0, sub: `${s?.orders_month ?? 0} this month`, link: '/orders', query: {} },
      { label: 'Sales this month', value: inr(s?.sales_month), sub: 'Confirmed, shipped and delivered', link: '/orders', query: { status: 'delivered' } },
      { label: 'Unread enquiries', value: s?.unread_enquiries ?? 0, sub: 'Messages from the contact form', link: '/enquiries', query: {} },
      { label: 'Products on sale', value: s?.active_products ?? 0, sub: `${s?.hidden_products ?? 0} hidden · ${s?.low_stock ?? 0} low on stock`, link: '/products', query: {} },
    ];
  });

  /** Clean integer ticks (0, 1, 2… or 0, 5, 10…) with the top tick at or above the busiest day. */
  private step = computed(() => {
    const m = Math.max(0, ...(this.d()?.days.map(x => x.orders) ?? [0]));
    return [1, 2, 5, 10, 20, 50, 100, 200, 500].find(s => m / s <= 4) ?? 1000;
  });
  readonly max = computed(() => {
    const m = Math.max(0, ...(this.d()?.days.map(x => x.orders) ?? [0]));
    return Math.max(this.step(), Math.ceil(m / this.step()) * this.step());
  });
  readonly ticks = computed(() => Array.from({ length: this.max() / this.step() + 1 }, (_, i) => i * this.step()));
  readonly peak = computed(() => {
    const days = this.d()?.days ?? [];
    return days.reduce((best, x, i) => x.orders > days[best].orders ? i : best, 0);
  });
  readonly chartLabel = computed(() => {
    const days = this.d()?.days ?? [];
    const total = days.reduce((n, x) => n + x.orders, 0);
    return `${total} orders in the last 14 days. Busiest day ${days[this.peak()]?.label ?? ''}.`;
  });

  constructor() { this.load(); }

  load() {
    this.error.set('');
    this.api.dashboard().subscribe({ next: d => this.d.set(d), error: e => this.error.set(errorText(e)) });
  }
  open(id: number) { this.router.navigate(['/orders', id]); }
}
