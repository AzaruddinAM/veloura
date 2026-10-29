import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, Enquiry, errorText } from '../core/api';
import { Counts, Toasts, inr, waLink, when } from '../core/ui';

@Component({
  selector: 'adm-enquiries',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div><h1>Enquiries</h1><p>Messages sent from the website's contact form.</p></div>
      <div class="chips">
        <button class="chip" [class.on]="!unread()" (click)="filter(false)">All</button>
        <button class="chip" [class.on]="unread()" (click)="filter(true)">Unread <b>{{ counts.unread() }}</b></button>
      </div>
    </div>

    @if (error()) {
      <div class="card empty"><b>Could not load enquiries</b>{{ error() }}</div>
    } @else if (loading() && !list().length) {
      <div class="stack">@for (i of [1, 2, 3]; track i) { <div class="skel" style="height:130px"></div> }</div>
    } @else if (!list().length) {
      <div class="card empty"><b>{{ unread() ? 'All caught up' : 'No enquiries yet' }}</b>{{ unread() ? 'There are no unread messages.' : 'Messages from the contact form appear here.' }}</div>
    } @else {
      <div class="stack">
        @for (e of list(); track e.id) {
          <article class="card msg" [class.unread]="!e.is_read">
            <header>
              <div>
                <b>{{ e.name }}</b> @if (!e.is_read) { <span class="pill pending">New</span> }
                <div class="muted small">{{ e.phone }} · {{ when(e.created_at) }}</div>
              </div>
              <div class="row">
                @if (wa(e); as link) { <a class="btn gold sm" [href]="link" target="_blank" rel="noopener" (click)="mark(e, true)">Reply on WhatsApp</a> }
                <a class="btn line sm" [href]="'tel:' + e.phone">Call</a>
              </div>
            </header>
            <p class="text">{{ e.message }}</p>
            <footer>
              @if (e.order) { <a [routerLink]="['/orders', e.order.id]">Bag sent with it: order {{ e.order.ref }} · {{ inr(e.order.total) }} →</a> } @else { <span></span> }
              <span class="row">
                <button class="btn ghost sm" (click)="mark(e, !e.is_read)">{{ e.is_read ? 'Mark unread' : 'Mark read' }}</button>
                <button class="btn ghost sm del" (click)="remove(e)">Delete</button>
              </span>
            </footer>
          </article>
        }
      </div>
      @if (pages() > 1) {
        <nav class="pager">
          <button class="btn line sm" [disabled]="page() <= 1" (click)="page.set(page() - 1)">‹ Previous</button>
          <span class="muted small">Page {{ page() }} of {{ pages() }}</span>
          <button class="btn line sm" [disabled]="page() >= pages()" (click)="page.set(page() + 1)">Next ›</button>
        </nav>
      }
    }
  `,
  styles: `
    :host{display:block}
    .msg{border-left:3px solid transparent}
    .msg.unread{border-left-color:var(--gold)}
    header{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap}
    header b{font-weight:500;font-size:1.05rem}
    .text{white-space:pre-line;margin:.8rem 0;color:var(--text2)}
    footer{display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:.6rem}
    .del:hover{color:var(--bad)!important}
  `,
})
export class EnquiriesPage {
  private api = inject(Api);
  private toasts = inject(Toasts);
  readonly counts = inject(Counts);
  readonly when = when;
  readonly inr = inr;

  readonly list = signal<Enquiry[]>([]);
  readonly unread = signal(false);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    effect(() => {
      const params = { page: this.page(), unread: this.unread() };
      this.loading.set(true);
      this.api.enquiries(params).subscribe({
        next: r => { this.list.set(r.data); this.pages.set(r.meta.pages); this.loading.set(false); this.error.set(''); },
        error: e => { this.error.set(errorText(e)); this.loading.set(false); },
      });
    });
  }

  filter(unread: boolean) { this.unread.set(unread); this.page.set(1); }
  wa(e: Enquiry) { return waLink(e.phone, `Hi ${e.name}, thank you for messaging Veloura. `); }

  mark(e: Enquiry, read: boolean) {
    if (e.is_read === read) return;
    this.list.update(l => l.map(x => x.id === e.id ? { ...x, is_read: read } : x));
    this.counts.unread.update(n => Math.max(0, n + (read ? -1 : 1)));
    this.api.markEnquiry(e.id, read).subscribe({ error: err => this.toasts.error(errorText(err)) });
  }
  remove(e: Enquiry) {
    if (!confirm(`Delete the message from ${e.name}?`)) return;
    this.api.deleteEnquiry(e.id).subscribe({
      next: () => {
        this.list.update(l => l.filter(x => x.id !== e.id));
        if (!e.is_read) this.counts.unread.update(n => Math.max(0, n - 1));
        this.toasts.ok('Message deleted');
      },
      error: err => this.toasts.error(errorText(err)),
    });
  }
}
