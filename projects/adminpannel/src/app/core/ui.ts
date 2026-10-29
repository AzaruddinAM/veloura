import { Injectable, signal } from '@angular/core';
import { Status } from './api';

export interface Toast { id: number; text: string; kind: 'ok' | 'error'; }

@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly list = signal<Toast[]>([]);
  private next = 1;

  ok(text: string) { this.push(text, 'ok'); }
  error(text: string) { this.push(text, 'error'); }

  private push(text: string, kind: Toast['kind']) {
    const t = { id: this.next++, text, kind };
    this.list.update(l => [...l, t].slice(-3));
    setTimeout(() => this.dismiss(t.id), kind === 'error' ? 6000 : 3000);
  }
  dismiss(id: number) { this.list.update(l => l.filter(t => t.id !== id)); }
}

/** Sidebar badge numbers; refreshed by the shell and after actions that change them. */
@Injectable({ providedIn: 'root' })
export class Counts {
  readonly pending = signal(0);
  readonly unread = signal(0);
}

export const STATUS_LABEL: Record<Status, string> = {
  pending: 'Pending', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};

export function inr(n: number | null | undefined) {
  return '₹' + (n ?? 0).toLocaleString('en-IN');
}

export function when(iso: string, withTime = true) {
  return new Date(iso).toLocaleString('en-IN', withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

/** wa.me link for a customer's phone; 10-digit Indian numbers get the 91 prefix. */
export function waLink(phone: string | null, text = '') {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) digits = '91' + digits;
  return digits ? `https://wa.me/${digits}${text ? '?text=' + encodeURIComponent(text) : ''}` : null;
}
