import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

/**
 * Where the Laravel backend lives. '/api' works with `ng serve` (see proxy.conf.json)
 * and in production when the site and backend share a domain. If the backend is on
 * another domain, put its full URL here, e.g. 'https://api.veloura.in/api'.
 */
export const API_URL = '/api';

/** Studio photo on a light or dark background, or a staged photo on a white box / dark velvet box. */
export type Theme = 'light' | 'dark' | 'real-white' | 'real-dark';
export interface Photo { img: string; srcset?: string | null; thumb?: string | null; theme?: Theme; }
export interface Product {
  id: number; name: string; cat: string; price: number; was: number; note: string;
  /** Pieces in stock; null/missing = not tracked (no limit). */
  stock?: number | null;
  /** Cover photo. */
  img: string; srcset?: string | null; thumb?: string | null;
  /** Photos to show, first one first: only the photo types chosen in the admin panel. */
  images?: Photo[];
}
export interface Catalogue { categories: string[]; products: Product[]; }

/** The order as the server saved it: reference, confirmed lines (database prices) and total. */
export interface PlacedOrder {
  ref: string; total: number;
  items: { id: number | null; name: string; price: number; qty: number; line_total: number }[];
}
export type BagItem = { id: number; qty: number };

@Injectable({ providedIn: 'root' })
export class ShopApi {
  private http = inject(HttpClient);

  /** fresh: skip the browser cache, e.g. after an order was refused for stock. */
  catalogue(fresh = false) {
    return this.http.get<Catalogue>(`${API_URL}/catalogue`, fresh ? { params: { t: Date.now() } } : {});
  }
  /** Saves the bag as an order; refused (422) when a piece is sold out or not enough is left. */
  order(items: BagItem[]) { return this.http.post<PlacedOrder>(`${API_URL}/orders`, { items }); }
  /** Contact form; when the bag has pieces they are sent too and saved as an order (same stock rules). */
  enquiry(v: { name: string; phone: string; message: string; items?: BagItem[] }) {
    return this.http.post<Partial<PlacedOrder> & { id: number }>(`${API_URL}/enquiries`, v);
  }
}
