import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, Order, STATUSES, Status, errorText } from '../core/api';
import { Counts, STATUS_LABEL, Toasts, inr, waLink, when } from '../core/ui';

@Component({
  selector: 'adm-order',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="no-print"><a routerLink="/orders">← All orders</a></p>
    @if (error()) {
      <div class="card empty"><b>Could not load this order</b>{{ error() }}</div>
    } @else if (!o()) {
      <div class="skel" style="height:60px;margin:1rem 0"></div><div class="skel" style="height:300px"></div>
    } @else {
      <div class="page-head">
        <div>
          <h1>Order {{ o()!.ref }}</h1>
          <p>{{ when(o()!.created_at) }} · via {{ o()!.channel }} · <span class="pill" [class]="o()!.status">{{ label[o()!.status] }}</span></p>
        </div>
        <div class="row no-print">
          @if (wa()) { <a class="btn line" [href]="wa()" target="_blank" rel="noopener">Message customer</a> }
          <button class="btn line" (click)="print()">Print</button>
        </div>
      </div>

      <div class="cols">
        <section class="card">
          <h2>Pieces</h2>
          <ul class="items">
            @for (i of o()!.items; track $index) {
              <li>
                @if (i.thumb) { <img [src]="i.thumb" alt="" width="56" height="56" /> } @else { <span class="noimg"></span> }
                <span class="nm"><b>{{ i.name }}</b><span class="muted small">{{ i.qty }} × {{ inr(i.price) }}</span></span>
                <span class="amt">{{ inr(i.line_total) }}</span>
              </li>
            }
          </ul>
          <p class="sum"><span>Total ({{ pieces() }} {{ pieces() === 1 ? 'piece' : 'pieces' }})</span><b>{{ inr(o()!.total) }}</b></p>
          @if (o()!.enquiry) {
            <div class="msg"><span class="muted small">Message from the contact form</span><p>{{ o()!.enquiry!.message }}</p></div>
          }
        </section>

        <div class="stack">
          <section class="card no-print">
            <h2>Status</h2>
            <div class="steps" role="radiogroup" aria-label="Order status">
              @for (s of statuses; track s) {
                <button role="radio" class="chip" [class.on]="o()!.status === s" [attr.aria-checked]="o()!.status === s" [disabled]="busy()" (click)="setStatus(s)">{{ label[s] }}</button>
              }
            </div>
            <p class="hint" style="margin-top:.7rem">Only confirmed, shipped and delivered orders count as sales.</p>
          </section>

          <form class="card" (ngSubmit)="save()">
            <h2>Customer</h2>
            <p class="hint" style="margin:-.5rem 0 .9rem">Customers send details on WhatsApp. Copy them here to keep a record.</p>
            <label class="field"><span>Name</span><input name="name" [(ngModel)]="form.customer_name" maxlength="80" /></label>
            <label class="field"><span>Phone</span><input name="phone" [(ngModel)]="form.phone" maxlength="20" inputmode="tel" /></label>
            <label class="field"><span>Delivery address</span><textarea name="address" rows="3" [(ngModel)]="form.address" maxlength="500"></textarea></label>
            <label class="field"><span>Notes</span><textarea name="note" rows="2" [(ngModel)]="form.note" maxlength="500"></textarea></label>
            <div class="row no-print">
              <button class="btn gold" [disabled]="busy()">Save details</button>
              <button type="button" class="btn danger" style="margin-left:auto" [disabled]="busy()" (click)="remove()">Delete order</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: `
    :host{display:block}
    .cols{display:grid;grid-template-columns:1.3fr 1fr;gap:1.2rem;align-items:start}
    @media (max-width:950px){.cols{grid-template-columns:1fr}}
    .items{list-style:none;padding:0}
    .items li{display:grid;grid-template-columns:56px 1fr auto;gap:.9rem;align-items:center;padding:.7rem 0;border-bottom:1px solid var(--line)}
    .items img,.noimg{width:56px;height:56px;border-radius:8px;object-fit:cover;background:var(--panel2)}
    .nm{display:grid}
    .nm b{font-weight:500}
    .amt{font-weight:500}
    .sum{display:flex;justify-content:space-between;padding-top:1rem;font-size:1.1rem}
    .sum b{color:var(--gold-hi);font-weight:500}
    .msg{margin-top:1.2rem;border:1px dashed var(--line2);border-radius:10px;padding:.8rem 1rem}
    .msg p{white-space:pre-line;margin-top:.3rem}
    .steps{display:flex;flex-wrap:wrap;gap:.4rem}
    @media print{.cols{grid-template-columns:1fr}}
  `,
})
export class OrderPage {
  private api = inject(Api);
  private router = inject(Router);
  private toasts = inject(Toasts);
  private counts = inject(Counts);
  readonly inr = inr;
  readonly when = when;
  readonly label = STATUS_LABEL;
  readonly statuses = STATUSES;

  readonly id = input.required<string>();
  readonly o = signal<Order | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  form = { customer_name: '', phone: '', address: '', note: '' };

  readonly pieces = computed(() => this.o()?.items.reduce((n, i) => n + i.qty, 0) ?? 0);
  readonly wa = computed(() => {
    const o = this.o();
    return o ? waLink(o.phone, `Hi ${o.customer_name || ''}, this is Veloura about your order ${o.ref} (${inr(o.total)}). It is now ${STATUS_LABEL[o.status].toLowerCase()}.`.replace('Hi ,', 'Hi,')) : null;
  });

  constructor() {
    effect(() => {
      this.api.order(+this.id()).subscribe({ next: o => this.show(o), error: e => this.error.set(errorText(e)) });
    });
  }

  private show(o: Order) {
    this.o.set(o);
    this.form = { customer_name: o.customer_name ?? '', phone: o.phone ?? '', address: o.address ?? '', note: o.note ?? '' };
  }

  setStatus(status: Status) {
    if (status === this.o()?.status) return;
    this.update({ status }, `Marked as ${STATUS_LABEL[status].toLowerCase()}`);
  }
  save() {
    this.update({ ...this.form }, 'Customer details saved');
  }
  private update(body: Parameters<Api['updateOrder']>[1], done: string) {
    this.busy.set(true);
    this.api.updateOrder(+this.id(), body).subscribe({
      next: o => {
        this.show(o); this.busy.set(false); this.toasts.ok(done);
        if (body.status) this.api.counts().subscribe(c => this.counts.pending.set(c.pending_orders));
      },
      error: e => { this.busy.set(false); this.toasts.error(errorText(e)); },
    });
  }
  remove() {
    if (!confirm(`Delete order ${this.o()?.ref}? This cannot be undone.`)) return;
    this.busy.set(true);
    this.api.deleteOrder(+this.id()).subscribe({
      next: () => { this.toasts.ok('Order deleted'); this.router.navigate(['/orders']); },
      error: e => { this.busy.set(false); this.toasts.error(errorText(e)); },
    });
  }
  print() { window.print(); }
}
