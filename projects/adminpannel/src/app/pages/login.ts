import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, errorText } from '../core/api';
import { Auth } from '../core/auth';

@Component({
  selector: 'adm-login',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="box card" (ngSubmit)="submit()" #f="ngForm">
      <img src="logo.webp" alt="Veloura" width="180" height="60" />
      <h1>Admin panel</h1>
      <p class="muted">Manage orders, products and messages.</p>
      @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
      <label class="field"><span>Email</span>
        <input type="email" name="email" [(ngModel)]="email" required autocomplete="username" autofocus />
      </label>
      <label class="field"><span>Password</span>
        <span class="pw">
          <input [type]="show() ? 'text' : 'password'" name="password" [(ngModel)]="password" required autocomplete="current-password" />
          <button type="button" class="btn ghost sm" (click)="show.set(!show())">{{ show() ? 'Hide' : 'Show' }}</button>
        </span>
      </label>
      <button class="btn gold" type="submit" [disabled]="busy() || !f.valid">{{ busy() ? 'Logging in…' : 'Log in' }}</button>
      <p class="hint">Forgot your password? On the server run <code>php artisan admin:create your&#64;email</code> to set a new one.</p>
    </form>
  `,
  styles: `
    :host{min-height:100vh;display:grid;place-items:center;padding:1rem;background:radial-gradient(60% 60% at 70% 20%,#3a2116 0,transparent 70%),var(--bg)}
    .box{width:min(400px,100%);padding:2rem;display:grid;gap:.2rem}
    img{width:150px;height:auto;mix-blend-mode:screen;margin:0 auto .8rem}
    h1{text-align:center}
    .box>p.muted{text-align:center;margin-bottom:1.2rem}
    .pw{position:relative;display:block}
    .pw input{padding-right:4.5rem}
    .pw .btn{position:absolute;right:.3rem;top:50%;transform:translateY(-50%)}
    .alert{background:#ef8a7a1a;border:1px solid #7a3b32;color:var(--bad);border-radius:9px;padding:.6rem .8rem;margin-bottom:1rem}
    .btn.gold{width:100%;margin-top:.4rem;padding:.7rem}
    .hint{text-align:center;margin-top:1rem}
    code{color:var(--text2)}
  `,
})
export class Login {
  private api = inject(Api);
  private auth = inject(Auth);
  private router = inject(Router);
  readonly next = input<string>();

  email = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal('');
  readonly show = signal(false);

  submit() {
    this.busy.set(true);
    this.error.set('');
    this.api.login(this.email.trim(), this.password).subscribe({
      next: r => {
        this.auth.set(r.token, r.user);
        this.router.navigateByUrl(this.next() || '/');
      },
      error: e => { this.error.set(errorText(e)); this.busy.set(false); },
    });
  }
}
