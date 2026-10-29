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
  /** Cover photo. */
  img: string; srcset?: string | null; thumb?: string | null;
  /** Photos to show, first one first: only the photo types chosen in the admin panel. */
  images?: Photo[];
}
export interface Catalogue { categories: string[]; products: Product[]; }

@Injectable({ providedIn: 'root' })
export class ShopApi {
  private http = inject(HttpClient);

  catalogue() { return this.http.get<Catalogue>(`${API_URL}/catalogue`); }
  order(ref: string, items: { id: number; qty: number }[]) { return this.http.post(`${API_URL}/orders`, { ref, items }); }
  /** Contact form; when the bag has pieces they are sent too and saved as an order. */
  enquiry(v: { name: string; phone: string; message: string; ref?: string; items?: { id: number; qty: number }[] }) {
    return this.http.post(`${API_URL}/enquiries`, v);
  }
}
