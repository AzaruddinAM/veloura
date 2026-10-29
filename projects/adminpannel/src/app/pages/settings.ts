import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ShopSettings, errorText, fieldErrors } from '../core/api';
import { Auth } from '../core/auth';
import { Toasts } from '../core/ui';

@Component({
  selector: 'adm-settings',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head"><div><h1>Settings</h1><p>How the shop looks, and your admin account.</p></div></div>

    <section class="card display">
      <h2>Shop display</h2>
      <p class="hint" style="margin:-.5rem 0 1rem">Which photo product cards show first. Customers can still switch photos with the dots on each card.</p>
      <div class="opts" role="radiogroup" aria-label="Default product photo">
        @for (o of themes; track o.value) {
          <button type="button" class="opt" role="radio" [class.on]="theme() === o.value" [attr.aria-checked]="theme() === o.value"
                  [disabled]="theme() === null || saving()" (click)="setTheme(o.value)">
            <span class="sw" [class]="o.value" aria-hidden="true"></span>
            <b>{{ o.label }}</b>
            <span class="hint">{{ o.hint }}</span>
          </button>
        }
      </div>
    </section>

    <div class="cols">
      <section class="card">
        <h2>Account</h2>
        <dl>
          <dt>Name</dt><dd>{{ auth.user()?.name }}</dd>
          <dt>Email</dt><dd>{{ auth.user()?.email }}</dd>
        </dl>
        <p class="hint">To add another admin, run <code>php artisan admin:create their&#64;email</code> on the server.</p>
      </section>

      <form class="card" (ngSubmit)="change()" #form="ngForm">
        <h2>Change password</h2>
        <label class="field"><span>Current password</span>
          <input type="password" name="current" [(ngModel)]="current" required autocomplete="current-password" />
          @if (errs()['current_password']) { <small class="err">{{ errs()['current_password'] }}</small> }
        </label>
        <label class="field"><span>New password</span>
          <input type="password" name="next" [(ngModel)]="next" required minlength="8" autocomplete="new-password" />
          <small class="hint">At least 8 characters.</small>
          @if (errs()['password']) { <small class="err">{{ errs()['password'] }}</small> }
        </label>
        <label class="field"><span>Repeat new password</span>
          <input type="password" name="again" [(ngModel)]="again" required autocomplete="new-password" />
          @if (again && again !== next) { <small class="err">The two new passwords are different.</small> }
        </label>
        <button class="btn gold" [disabled]="busy() || !form.valid || next !== again">{{ busy() ? 'Saving…' : 'Change password' }}</button>
        <p class="hint" style="margin-top:.8rem">Other devices that are logged in will be signed out.</p>
      </form>
    </div>
  `,
  styles: `
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;align-items:start}
    @media (max-width:900px){.cols{grid-template-columns:1fr}}
    dl{display:grid;grid-template-columns:auto 1fr;gap:.4rem 1rem;margin-bottom:1rem}
    dt{color:var(--muted)}
    code{color:var(--text2)}
    .display{margin-bottom:1.2rem}
    .opts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.8rem}
    @media (max-width:700px){.opts{grid-template-columns:1fr}}
    .opt{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;gap:.15rem .8rem;align-items:center;text-align:left;border:1px solid var(--line2);border-radius:12px;padding:.8rem .9rem;transition:border-color .2s,background .2s}
    .opt:hover:not(:disabled){border-color:var(--gold)}
    .opt.on{border-color:var(--gold);background:#d4a95a14;box-shadow:inset 0 0 0 1px var(--gold)}
    .opt:disabled{cursor:default}
    .opt b{font-weight:500}
    .opt .hint{grid-column:2}
    .sw{grid-row:1/3;width:44px;height:44px;border-radius:8px;border:1px solid var(--line2)}
    .sw.light{background:radial-gradient(circle at 50% 42%,#fbf6ee,#e8dccb)}
    .sw.dark{background:radial-gradient(circle at 50% 42%,#3a2416,#0f0806)}
    .sw.cover{background:linear-gradient(135deg,#f3eadc 50%,#2a1a10 50%)}
    .sw.real-white{background:linear-gradient(180deg,#f4f1ec 0 40%,#ffffff 40% 78%,#ddd5c9 78%)}
    .sw.real-dark{background:linear-gradient(180deg,#2e1d13 0 40%,#3a2418 40% 78%,#120a06 78%)}
  `,
})
export class SettingsPage {
  readonly auth = inject(Auth);
  private api = inject(Api);
  private toasts = inject(Toasts);
  readonly busy = signal(false);
  readonly errs = signal<Record<string, string>>({});
  current = '';
  next = '';
  again = '';

  readonly themes: { value: ShopSettings['photo_theme']; label: string; hint: string }[] = [
    { value: 'cover', label: 'Each product’s cover', hint: 'The first photo of each product' },
    { value: 'light', label: 'Light background', hint: 'Cream photos where available' },
    { value: 'dark', label: 'Dark background', hint: 'Dark photos where available' },
    { value: 'real-white', label: 'Real: white box', hint: 'Staged on a white display box' },
    { value: 'real-dark', label: 'Real: dark velvet box', hint: 'Staged on a dark velvet box' },
  ];
  readonly theme = signal<ShopSettings['photo_theme'] | null>(null);
  readonly saving = signal(false);

  constructor() {
    this.api.settings().subscribe({ next: s => this.theme.set(s.photo_theme), error: e => this.toasts.error(errorText(e)) });
  }

  setTheme(value: ShopSettings['photo_theme']) {
    if (value === this.theme()) return;
    const before = this.theme();
    this.theme.set(value);
    this.saving.set(true);
    this.api.saveSettings({ photo_theme: value }).subscribe({
      next: s => { this.theme.set(s.photo_theme); this.saving.set(false); this.toasts.ok('Shop display saved'); },
      error: e => { this.theme.set(before); this.saving.set(false); this.toasts.error(errorText(e)); },
    });
  }

  change() {
    this.busy.set(true);
    this.errs.set({});
    this.api.password({ current_password: this.current, password: this.next, password_confirmation: this.again }).subscribe({
      next: () => {
        this.busy.set(false);
        this.current = this.next = this.again = '';
        this.toasts.ok('Password changed');
      },
      error: e => { this.busy.set(false); this.errs.set(fieldErrors(e)); this.toasts.error(errorText(e)); },
    });
  }
}
