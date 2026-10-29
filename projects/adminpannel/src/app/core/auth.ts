import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export interface AdminUser { name: string; email: string; }

const TOKEN = 'veloura-admin-token';
const USER = 'veloura-admin-user';

/** Holds the login token (a Sanctum bearer token) in localStorage. */
@Injectable({ providedIn: 'root' })
export class Auth {
  readonly token = signal<string | null>(localStorage.getItem(TOKEN));
  readonly user = signal<AdminUser | null>(JSON.parse(localStorage.getItem(USER) ?? 'null'));
  readonly signedIn = computed(() => !!this.token());

  set(token: string, user: AdminUser) {
    localStorage.setItem(TOKEN, token);
    localStorage.setItem(USER, JSON.stringify(user));
    this.token.set(token);
    this.user.set(user);
  }

  clear() {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(USER);
    this.token.set(null);
    this.user.set(null);
  }
}

/** Adds the token to API calls; an expired or revoked login sends you back to the login page. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const token = auth.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }) : req.clone({ setHeaders: { Accept: 'application/json' } });

  return next(authed).pipe(catchError((e: HttpErrorResponse) => {
    if (e.status === 401 && !req.url.endsWith('/login')) {
      auth.clear();
      router.navigate(['/login'], { queryParams: { next: router.url } });
    }
    return throwError(() => e);
  }));
};

export const signedInGuard: CanActivateFn = () => inject(Auth).signedIn() || inject(Router).createUrlTree(['/login']);
export const signedOutGuard: CanActivateFn = () => !inject(Auth).signedIn() || inject(Router).createUrlTree(['/']);
