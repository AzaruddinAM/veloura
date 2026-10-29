import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Api, SITE_URL } from './core/api';
import { Auth } from './core/auth';
import { Counts } from './core/ui';

const ICONS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z',
  orders: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  products: 'M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5M12 12v10',
  categories: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z',
  enquiries: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  store: 'M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6',
};

@Component({
  selector: 'adm-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'menu.set(false)' },
  template: `
    <aside class="side no-print" [class.open]="menu()">
      <a routerLink="/" class="brand" (click)="menu.set(false)"><img src="logo.webp" alt="Veloura" width="140" height="47" /><span>Admin</span></a>
      <nav>
        @for (n of nav; track n.path) {
          <a [routerLink]="n.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: n.path === '/' }" (click)="menu.set(false)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="icons[n.icon]" /></svg>
            {{ n.label }}
            @if (n.icon === 'orders' && counts.pending()) { <b class="badge" [attr.aria-label]="counts.pending() + ' pending'">{{ counts.pending() }}</b> }
            @if (n.icon === 'enquiries' && counts.unread()) { <b class="badge" [attr.aria-label]="counts.unread() + ' unread'">{{ counts.unread() }}</b> }
          </a>
        }
      </nav>
      <div class="foot">
        <a class="store" [href]="site" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="icons['store']" /></svg>View website</a>
        <div class="me">
          <span><b>{{ auth.user()?.name }}</b><small>{{ auth.user()?.email }}</small></span>
          <button class="btn ghost sm" (click)="logout()">Log out</button>
        </div>
      </div>
    </aside>
    @if (menu()) { <div class="scrim no-print" (click)="menu.set(false)"></div> }

    <div class="main">
      <header class="top no-print">
        <button class="burger" (click)="menu.set(true)" aria-label="Open menu"><i></i><i></i><i></i></button>
        <img src="logo.webp" alt="Veloura" width="110" height="37" />
      </header>
      <main><router-outlet /></main>
    </div>
  `,
  styles: `
    :host{display:grid;grid-template-columns:250px 1fr;min-height:100vh}
    .side{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;background:var(--ink);border-right:1px solid var(--line);padding:1.2rem .9rem}
    .brand{display:flex;align-items:center;gap:.6rem;padding:.2rem .5rem 1.4rem;text-decoration:none!important}
    .brand img{width:120px;height:auto;mix-blend-mode:screen}
    .brand span{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line2);border-radius:99px;padding:.05rem .5rem}
    nav{display:grid;gap:.15rem}
    nav a,.store{display:flex;align-items:center;gap:.75rem;padding:.6rem .8rem;border-radius:10px;color:var(--text2);text-decoration:none!important;transition:background .15s,color .15s}
    nav a:hover,.store:hover{background:#ffffff08;color:var(--cream)}
    nav a.on{background:linear-gradient(90deg,#d4a95a26,#d4a95a08);color:var(--gold-hi);box-shadow:inset 3px 0 0 var(--gold)}
    svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
    .badge{margin-left:auto;background:var(--gold);color:var(--ink);border-radius:99px;font-size:.75rem;font-weight:500;min-width:1.5rem;text-align:center;padding:0 .4rem}
    .foot{margin-top:auto;display:grid;gap:.6rem;border-top:1px solid var(--line);padding-top:.9rem}
    .me{display:flex;align-items:center;justify-content:space-between;gap:.4rem;padding:0 .3rem 0 .8rem}
    .me span{display:grid;min-width:0}
    .me b{font-weight:500;font-size:.9rem}
    .me small{color:var(--muted);font-size:.75rem;overflow:hidden;text-overflow:ellipsis}
    .main{min-width:0}
    main{padding:clamp(1rem,3vw,2.2rem);max-width:1250px;margin:0 auto}
    .top{display:none}
    .scrim{display:none}
    @media (max-width:900px){
      :host{grid-template-columns:1fr}
      .side{position:fixed;z-index:50;left:0;top:0;bottom:0;width:min(280px,85vw);transform:translateX(-100%);transition:transform .3s cubic-bezier(.2,.8,.2,1)}
      .side.open{transform:none;box-shadow:20px 0 40px #000c}
      .scrim{display:block;position:fixed;inset:0;z-index:40;background:#000a}
      .top{display:flex;align-items:center;gap:1rem;position:sticky;top:0;z-index:30;padding:.6rem 1rem;background:rgba(11,6,5,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
      .top img{mix-blend-mode:screen}
      .burger{display:grid;gap:5px;width:36px;height:36px;place-content:center}
      .burger i{display:block;width:20px;height:1.5px;background:var(--gold)}
    }
    @media print{:host{display:block}}
  `,
})
export class Shell {
  readonly auth = inject(Auth);
  readonly counts = inject(Counts);
  private api = inject(Api);
  private router = inject(Router);
  readonly icons = ICONS;
  readonly site = SITE_URL;
  readonly menu = signal(false);
  readonly nav = [
    { path: '/', label: 'Dashboard', icon: 'dashboard' },
    { path: '/orders', label: 'Orders', icon: 'orders' },
    { path: '/products', label: 'Products', icon: 'products' },
    { path: '/categories', label: 'Categories', icon: 'categories' },
    { path: '/enquiries', label: 'Enquiries', icon: 'enquiries' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  constructor() {
    // Keep the sidebar badges fresh: on every page change and once a minute.
    const refresh = () => this.api.counts().subscribe({
      next: c => { this.counts.pending.set(c.pending_orders); this.counts.unread.set(c.unread_enquiries); },
      error: () => { /* the interceptor handles logouts; badges can wait */ },
    });
    refresh();
    const nav = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(refresh);
    const timer = setInterval(refresh, 60_000);
    inject(DestroyRef).onDestroy(() => { nav.unsubscribe(); clearInterval(timer); });
  }

  logout() {
    this.api.logout().subscribe({ complete: () => this.done(), error: () => this.done() });
  }
  private done() {
    this.auth.clear();
    this.router.navigate(['/login']);
  }
}
