import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

/**
 * Where the Laravel backend lives. '/api' works with `ng serve` (see proxy.conf.json)
 * and in production when the site and backend share a domain. If the backend is on
 * another domain, put its full URL here, e.g. 'https://api.veloura.in/api'.
 */
export const API_URL = '/api';

export interface Product {
  id: number; name: string; cat: string; price: number; was: number; note: string;
  img: string; srcset?: string | null; thumb?: string | null;
}
export interface Catalogue { categories: string[]; products: Product[]; }

@Injectable({ providedIn: 'root' })
export class ShopApi {
  private http = inject(HttpClient);

  catalogue() { return this.http.get<Catalogue>(`${API_URL}/catalogue`); }
  order(ref: string, items: { id: number; qty: number }[]) { return this.http.post(`${API_URL}/orders`, { ref, items }); }
  enquiry(v: { name: string; phone: string; message: string }) { return this.http.post(`${API_URL}/enquiries`, v); }
}
