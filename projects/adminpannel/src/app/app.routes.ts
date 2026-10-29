import { Routes } from '@angular/router';
import { signedInGuard, signedOutGuard } from './core/auth';
import { Shell } from './shell';

const t = (page: string) => `${page} · Veloura Admin`;

export const routes: Routes = [
  { path: 'login', canActivate: [signedOutGuard], title: t('Log in'), loadComponent: () => import('./pages/login').then(m => m.Login) },
  {
    path: '', component: Shell, canActivate: [signedInGuard], children: [
      { path: '', title: t('Dashboard'), loadComponent: () => import('./pages/dashboard').then(m => m.DashboardPage) },
      { path: 'orders', title: t('Orders'), loadComponent: () => import('./pages/orders').then(m => m.OrdersPage) },
      { path: 'orders/:id', title: t('Order'), loadComponent: () => import('./pages/order').then(m => m.OrderPage) },
      { path: 'products', title: t('Products'), loadComponent: () => import('./pages/products').then(m => m.ProductsPage) },
      { path: 'products/new', title: t('Add product'), loadComponent: () => import('./pages/product-form').then(m => m.ProductFormPage) },
      { path: 'products/:id', title: t('Edit product'), loadComponent: () => import('./pages/product-form').then(m => m.ProductFormPage) },
      { path: 'categories', title: t('Categories'), loadComponent: () => import('./pages/categories').then(m => m.CategoriesPage) },
      { path: 'enquiries', title: t('Enquiries'), loadComponent: () => import('./pages/enquiries').then(m => m.EnquiriesPage) },
      { path: 'settings', title: t('Settings'), loadComponent: () => import('./pages/settings').then(m => m.SettingsPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
