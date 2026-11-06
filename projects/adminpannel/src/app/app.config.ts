import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { NavigationError, provideRouter, withComponentInputBinding, withHashLocation, withInMemoryScrolling, withNavigationErrorHandler } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth';

/**
 * After a deploy, a tab opened earlier still points at the old page scripts, which
 * are gone from the server. Opening another page then fails to load its script:
 * reload once to get the new version (the flag stops a reload loop if the server is down).
 */
function reloadOnNewVersion(e: NavigationError): void {
  const msg: string = String((e.error as Error)?.message ?? e.error);
  if (!/dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(msg)) return;
  if (sessionStorage.getItem('adm-reloaded') === e.url) return;
  sessionStorage.setItem('adm-reloaded', e.url);
  location.hash = '#' + e.url;
  location.reload();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash URLs (/adminpannel/#/orders/5) work on any host without server rewrite rules.
    provideRouter(routes, withHashLocation(), withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      withNavigationErrorHandler(reloadOnNewVersion)),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ],
};
