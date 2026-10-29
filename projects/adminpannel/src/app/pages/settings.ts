import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ShopSettings, Theme, errorText, fieldErrors } from '../core/api';
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
      <p class="hint" style="margin:-.5rem 0 1rem">Which photos product cards show. Choose one or more; with several, customers switch between them with the dots on each card. Each product can choose its own instead.</p>
      <div class="opts" role="group" aria-label="Photos shown in the shop">
        @for (o of themes; track o.value) {
          @let on = chosen()?.includes(o.value) ?? false;
          <button type="button" class="opt" role="checkbox" [class.on]="on" [attr.aria-checked]="on"
                  [disabled]="chosen() === null || saving() || (on && chosen()!.length === 1)" (click)="toggle(o.value)"
                  [title]="on && chosen()!.length === 1 ? 'At least one type must stay on' : ''">
            <span class="sw" [class]="o.value" aria-hidden="true"></span>
            <b>{{ o.label }}</b>
            <span class="hint">{{ o.hint }}</span>
            <span class="tick" aria-hidden="true"></span>
          </button>
        }
      </div>
      @if (chosen(); as c) {
        <p class="hint" style="margin-top:.8rem">
          @if (c.length === 1) { Cards show only the <b>{{ label(c[0]) }}</b> photo, with no switcher. }
          @else { Cards show {{ c.length }} photo types; the first in each product’s photo order is shown first. }
          Products without a chosen type show their cover.
        </p>
      }
    </section>

    <section class="card display">
      <h2>Cover photo</h2>
      <p class="hint" style="margin:-.5rem 0 1rem">The photo each card shows first, also used in the bag. Pick a type to use it as the cover for every product that has it.</p>
      <div class="opts" role="radiogroup" aria-label="Cover photo">
        @for (o of covers; track o.value) {
          @let on = cover() === o.value;
          <button type="button" class="opt" role="radio" [class.on]="on" [attr.aria-checked]="on"
                  [disabled]="cover() === null || saving()" (click)="setCover(o.value)">
            <span class="sw" [class]="o.value" aria-hidden="true"></span>
            <b>{{ o.label }}</b>
            <span class="hint">{{ o.hint }}</span>
            <span class="tick radio" aria-hidden="true"></span>
          </button>
        }
      </div>
      @if (cover(); as c) {
        <p class="hint" style="margin-top:.8rem">
          @if (c === 'product') { Each product keeps the first photo of its own photo order as the cover. }
          @else if (chosen() && !chosen()!.includes(c)) { <span class="warn">{{ label(c) }} is not ticked under Shop display, so it only applies to products that choose this type themselves.</span> }
          @else { Products with a {{ label(c) }} photo show it first; the rest keep their own cover. }
        </p>
      }
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
    .opt{position:relative;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;gap:.15rem .8rem;align-items:center;text-align:left;border:1px solid var(--line2);border-radius:12px;padding:.8rem .9rem;transition:border-color .2s,background .2s}
    .opt:hover:not(:disabled){border-color:var(--gold)}
    .opt.on{border-color:var(--gold);background:#d4a95a14;box-shadow:inset 0 0 0 1px var(--gold)}
    .opt:disabled{cursor:default}
    .opt b{font-weight:500}
    .opt .hint{grid-column:2}
    .sw{grid-row:1/3;width:44px;height:44px;border-radius:8px;border:1px solid var(--line2)}
    .sw.light{background:radial-gradient(circle at 50% 42%,#fbf6ee,#e8dccb)}
    .sw.dark{background:radial-gradient(circle at 50% 42%,#3a2416,#0f0806)}
    .tick{position:absolute;right:.7rem;top:.7rem;width:18px;height:18px;border-radius:5px;border:1.5px solid var(--line2)}
    .opt.on .tick{background:var(--gold);border-color:var(--gold)}
    .opt.on .tick::after{content:'';position:absolute;left:5px;top:1px;width:5px;height:10px;border:solid var(--ink);border-width:0 2px 2px 0;transform:rotate(45deg)}
    .sw.real-white{background:linear-gradient(180deg,#f4f1ec 0 40%,#ffffff 40% 78%,#ddd5c9 78%)}
    .sw.real-dark{background:linear-gradient(180deg,#2e1d13 0 40%,#3a2418 40% 78%,#120a06 78%)}
    .sw.product{background:linear-gradient(135deg,#f3eadc 50%,#2a1a10 50%)}
    .tick.radio{border-radius:50%}
    .opt.on .tick.radio::after{left:4px;top:4px;width:7px;height:7px;border:0;border-radius:50%;background:var(--ink);transform:none}
    .warn{color:var(--warn)}
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

  readonly themes: { value: Theme; label: string; hint: string }[] = [
    { value: 'light', label: 'Light background', hint: 'Studio photo on cream' },
    { value: 'dark', label: 'Dark background', hint: 'Studio photo on dark' },
    { value: 'real-white', label: 'Real: white box', hint: 'Staged on a white display box' },
    { value: 'real-dark', label: 'Real: dark velvet box', hint: 'Staged on a dark velvet box' },
  ];
  readonly chosen = signal<ShopSettings['photo_themes'] | null>(null);
  readonly covers: { value: ShopSettings['cover_theme']; label: string; hint: string }[] = [
    { value: 'product', label: 'Each product’s own cover', hint: 'Its first photo' },
    ...this.themes,
  ];
  readonly cover = signal<ShopSettings['cover_theme'] | null>(null);
  readonly saving = signal(false);

  constructor() {
    this.api.settings().subscribe({
      next: s => { this.chosen.set(s.photo_themes); this.cover.set(s.cover_theme); },
      error: e => this.toasts.error(errorText(e)),
    });
  }

  setCover(value: ShopSettings['cover_theme']) {
    const before = this.cover();
    if (before === null || value === before) return;
    this.cover.set(value);
    this.saving.set(true);
    this.api.saveSettings({ cover_theme: value }).subscribe({
      next: s => { this.cover.set(s.cover_theme); this.saving.set(false); this.toasts.ok('Cover photo saved'); },
      error: e => { this.cover.set(before); this.saving.set(false); this.toasts.error(errorText(e)); },
    });
  }

  label(t: Theme) { return this.themes.find(o => o.value === t)!.label.toLowerCase(); }

  toggle(value: Theme) {
    const before = this.chosen();
    if (!before) return;
    const next = before.includes(value) ? before.filter(t => t !== value) : this.themes.map(o => o.value).filter(t => t === value || before.includes(t));
    if (!next.length) return;
    this.chosen.set(next);
    this.saving.set(true);
    this.api.saveSettings({ photo_themes: next }).subscribe({
      next: s => { this.chosen.set(s.photo_themes); this.saving.set(false); this.toasts.ok('Shop display saved'); },
      error: e => { this.chosen.set(before); this.saving.set(false); this.toasts.error(errorText(e)); },
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
