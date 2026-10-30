import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AdminUser } from './auth';

/**
 * Where the Laravel API lives. '/api' works when the panel is served by Laravel
 * at /adminpannel (production) and with `npm run start:admin` (dev proxy).
 */
export const API = '/api/admin';

/** The shop website, for the "View website" link. Change it if the shop is on another domain. */
export const SITE_URL = '/';

export type Status = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export const STATUSES: Status[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export interface Crop { x: number; y: number; size: number; }
export interface Page<T> { data: T[]; meta: { page: number; pages: number; total: number }; }

export interface OrderRow {
  id: number; ref: string; customer_name: string | null; phone: string | null;
  total: number; status: Status; items_count: number; created_at: string;
}
export interface OrderItem { name: string; price: number; qty: number; line_total: number; thumb: string | null; }
export interface Order extends OrderRow {
  address: string | null; note: string | null; channel: string;
  items: OrderItem[]; enquiry: { id: number; message: string } | null;
}
/** Studio photo on a light / dark background, or a staged photo on a white box / dark velvet box. */
export type Theme = 'light' | 'dark' | 'real-white' | 'real-dark';
export const THEME_KINDS: { value: Theme; label: string; short: string }[] = [
  { value: 'light', label: 'Light background', short: 'Light' },
  { value: 'dark', label: 'Dark background', short: 'Dark' },
  { value: 'real-white', label: 'Real: white box', short: 'Real white' },
  { value: 'real-dark', label: 'Real: dark velvet box', short: 'Real dark' },
];
export interface ShopSettings {
  /** Photo types the shop shows (one or more). With one, cards show only that photo. */
  photo_themes: Theme[];
  /** Photo type used as the cover (first photo, also in the bag); 'product' keeps each product's own. */
  cover_theme: 'product' | Theme;
}
export interface Photo {
  id: number; theme: Theme; sort: number; crop: Crop; original: string;
  img: string; srcset: string; thumb: string;
}
export interface Product {
  id: number; category_id: number; category: string; name: string; note: string;
  price: number; was_price: number; is_active: boolean; sort: number;
  /** Pieces in stock; null = not tracked (no limit). */
  stock: number | null;
  /** Photo types shown in the shop for this product; null follows the shop setting. */
  themes: Theme[] | null;
  /** Cover photo (the first of `photos`). */
  img: string | null; srcset: string | null; thumb: string | null;
  photos: Photo[];
  updated_at: string;
}
export interface Category { id: number; name: string; sort: number; products_count: number; }
export interface Enquiry {
  id: number; name: string; phone: string; message: string; is_read: boolean;
  order: { id: number; ref: string; total: number } | null; created_at: string;
}
export interface Dashboard {
  stats: {
    pending_orders: number; orders_today: number; orders_month: number; sales_month: number;
    unread_enquiries: number; active_products: number; hidden_products: number; low_stock: number;
  };
  days: { date: string; label: string; orders: number; total: number }[];
  top_products: { name: string; qty: number; total: number }[];
  latest_orders: OrderRow[];
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  login(email: string, password: string) { return this.http.post<{ token: string; user: AdminUser }>(`${API}/login`, { email, password }); }
  logout() { return this.http.post(`${API}/logout`, {}); }
  password(body: { current_password: string; password: string; password_confirmation: string }) { return this.http.put(`${API}/password`, body); }

  settings() { return this.http.get<ShopSettings>(`${API}/settings`); }
  saveSettings(body: Partial<ShopSettings>) { return this.http.put<ShopSettings>(`${API}/settings`, body); }

  dashboard() { return this.http.get<Dashboard>(`${API}/dashboard`); }
  counts() { return this.http.get<{ pending_orders: number; unread_enquiries: number }>(`${API}/counts`); }

  orders(params: { page?: number; status?: string; q?: string }) {
    return this.http.get<Page<OrderRow> & { counts: Record<string, number> }>(`${API}/orders`, { params: clean(params) });
  }
  order(id: number) { return this.http.get<Order>(`${API}/orders/${id}`); }
  updateOrder(id: number, body: Partial<Pick<Order, 'status' | 'customer_name' | 'phone' | 'address' | 'note'>>) { return this.http.patch<Order>(`${API}/orders/${id}`, body); }
  deleteOrder(id: number) { return this.http.delete(`${API}/orders/${id}`); }

  products() { return this.http.get<Product[]>(`${API}/products`); }
  saveProduct(id: number | null, body: FormData) { return this.http.post<Product>(id ? `${API}/products/${id}` : `${API}/products`, body); }
  patchProduct(id: number, body: Partial<Pick<Product, 'is_active' | 'sort' | 'price' | 'stock'>>) { return this.http.patch<Product>(`${API}/products/${id}`, body); }
  deleteProduct(id: number) { return this.http.delete(`${API}/products/${id}`); }

  addPhoto(productId: number, body: FormData) { return this.http.post<Product>(`${API}/products/${productId}/photos`, body); }
  updatePhoto(productId: number, photoId: number, body: { crop?: Crop; theme?: Theme }) { return this.http.patch<Product>(`${API}/products/${productId}/photos/${photoId}`, body); }
  deletePhoto(productId: number, photoId: number) { return this.http.delete<Product>(`${API}/products/${productId}/photos/${photoId}`); }
  orderPhotos(productId: number, ids: number[]) { return this.http.put<Product>(`${API}/products/${productId}/photos/order`, { ids }); }

  categories() { return this.http.get<Category[]>(`${API}/categories`); }
  addCategory(body: { name: string; sort: number | null }) { return this.http.post<Category>(`${API}/categories`, body); }
  updateCategory(id: number, body: { name: string; sort: number }) { return this.http.put<Category>(`${API}/categories/${id}`, body); }
  deleteCategory(id: number) { return this.http.delete(`${API}/categories/${id}`); }

  enquiries(params: { page?: number; unread?: boolean }) { return this.http.get<Page<Enquiry>>(`${API}/enquiries`, { params: clean({ ...params, unread: params.unread ? 1 : undefined }) }); }
  markEnquiry(id: number, is_read: boolean) { return this.http.patch(`${API}/enquiries/${id}`, { is_read }); }
  deleteEnquiry(id: number) { return this.http.delete(`${API}/enquiries/${id}`); }
}

function clean(o: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)]));
}

/** The first readable message from a Laravel error response. */
export function errorText(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    const errors = e.error?.errors as Record<string, string[]> | undefined;
    if (errors) return Object.values(errors)[0]?.[0] ?? 'Please check the form.';
    if (e.status === 0) return 'Cannot reach the server. Is the backend running?';
    if (e.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    return e.error?.message || `Something went wrong (${e.status}).`;
  }
  return 'Something went wrong.';
}

/** Field-by-field validation messages, for showing under inputs. */
export function fieldErrors(e: unknown): Record<string, string> {
  const errors = e instanceof HttpErrorResponse ? e.error?.errors as Record<string, string[]> | undefined : undefined;
  return Object.fromEntries(Object.entries(errors ?? {}).map(([k, v]) => [k, v[0]]));
}
