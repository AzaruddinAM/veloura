import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toasts } from './core/ui';

@Component({
  selector: 'adm-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <div class="toasts" aria-live="polite">
      @for (t of toasts.list(); track t.id) {
        <div class="toast" [class.error]="t.kind === 'error'" role="status">
          <span>{{ t.text }}</span>
          <button (click)="toasts.dismiss(t.id)" aria-label="Dismiss">✕</button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts{position:fixed;right:1rem;bottom:1rem;z-index:100;display:grid;gap:.5rem;max-width:min(92vw,380px)}
    .toast{display:flex;gap:.8rem;align-items:flex-start;justify-content:space-between;background:var(--panel2);border:1px solid var(--gold);border-left-width:4px;border-radius:10px;padding:.7rem .9rem;box-shadow:0 12px 30px #000a;animation:in .25s ease-out}
    .toast.error{border-color:var(--bad)}
    .toast button{color:var(--muted);font-size:.8rem}
    @keyframes in{from{opacity:0;transform:translateY(10px)}}
  `,
})
export class App {
  readonly toasts = inject(Toasts);
}
