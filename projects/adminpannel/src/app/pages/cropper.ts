import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { Crop } from '../core/api';

/**
 * Pick the square of a photo that the shop shows. Drag to move, use the slider,
 * mouse wheel or pinch to zoom. Emits the square as fractions of the photo
 * ({x, y, size}), which the backend uses to cut the WebP sizes.
 *
 * The state is kept in photo pixels (left, top, side), so resizing the window
 * never changes the chosen square.
 */
@Component({
  selector: 'adm-cropper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #frame class="frame" [class.ready]="ready()"
         (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="up($event)" (wheel)="wheel($event)"
         role="img" aria-label="Photo crop area. Drag to move, use the zoom slider to resize.">
      <img [src]="src()" alt="" draggable="false" (load)="loaded($event)" [style.width.px]="w()" [style.transform]="transform()" />
      <i class="thirds" aria-hidden="true"></i>
      @if (!ready()) { <span class="loading">Loading photo…</span> }
    </div>
    <div class="controls">
      <span aria-hidden="true">−</span>
      <input type="range" min="1" max="4" step="0.01" [value]="zoom()" (input)="setZoom(+$any($event.target).value)" aria-label="Zoom" [disabled]="!ready()" />
      <span aria-hidden="true">+</span>
      <button type="button" class="btn ghost sm" (click)="centre()" [disabled]="!ready()">Centre</button>
    </div>
  `,
  styles: `
    :host{display:grid;gap:.6rem}
    .frame{position:relative;width:100%;aspect-ratio:1;overflow:hidden;border-radius:10px;background:#000;cursor:grab;touch-action:none;user-select:none;border:1px solid var(--gold)}
    .frame:active{cursor:grabbing}
    img{position:absolute;left:0;top:0;max-width:none;transform-origin:0 0;opacity:0;transition:opacity .2s;pointer-events:none}
    .ready img{opacity:1}
    .thirds{position:absolute;inset:0;pointer-events:none;background:
      linear-gradient(90deg,transparent calc(33.33% - .5px),#fff4 calc(33.33% - .5px),#fff4 calc(33.33% + .5px),transparent calc(33.33% + .5px),transparent calc(66.66% - .5px),#fff4 calc(66.66% - .5px),#fff4 calc(66.66% + .5px),transparent calc(66.66% + .5px)),
      linear-gradient(0deg,transparent calc(33.33% - .5px),#fff4 calc(33.33% - .5px),#fff4 calc(33.33% + .5px),transparent calc(33.33% + .5px),transparent calc(66.66% - .5px),#fff4 calc(66.66% - .5px),#fff4 calc(66.66% + .5px),transparent calc(66.66% + .5px))}
    .loading{position:absolute;inset:0;display:grid;place-items:center;color:var(--muted)}
    .controls{display:flex;align-items:center;gap:.6rem;color:var(--muted)}
    .controls input{flex:1;padding:0;accent-color:var(--gold);background:none;border:0}
  `,
})
export class Cropper {
  readonly src = input.required<string>();
  /** Square to start from (e.g. the product's current crop); centre when empty. */
  readonly initial = input<Crop | null>(null);
  readonly cropChange = output<Crop>();

  private frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  readonly w = signal(0);
  readonly h = signal(0);
  readonly view = signal(320);
  readonly ready = signal(false);
  // Chosen square in photo pixels.
  private left = signal(0);
  private top = signal(0);
  private side = signal(1);

  private short = computed(() => Math.min(this.w(), this.h()));
  readonly zoom = computed(() => this.short() / this.side());
  readonly transform = computed(() => {
    const s = this.view() / this.side();
    return `translate(${-this.left() * s}px, ${-this.top() * s}px) scale(${s})`;
  });

  private pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;

  constructor() {
    const ro = new ResizeObserver(([e]) => this.view.set(e.contentRect.width || 320));
    afterNextRender(() => ro.observe(this.frame().nativeElement));
    inject(DestroyRef).onDestroy(() => ro.disconnect());
  }

  loaded(e: Event) {
    const img = e.target as HTMLImageElement;
    this.w.set(img.naturalWidth);
    this.h.set(img.naturalHeight);
    const c = this.initial();
    if (c) {
      this.side.set(c.size * img.naturalWidth);
      this.left.set(c.x * img.naturalWidth);
      this.top.set(c.y * img.naturalHeight);
      this.clamp();
    } else {
      this.centre();
    }
    this.ready.set(true);
    this.emit();
  }

  centre() {
    this.side.set(this.short());
    this.left.set((this.w() - this.short()) / 2);
    this.top.set((this.h() - this.short()) / 2);
    this.emit();
  }

  setZoom(z: number) {
    // Zoom around the centre of the frame.
    const cx = this.left() + this.side() / 2, cy = this.top() + this.side() / 2;
    const side = this.short() / Math.min(4, Math.max(1, z));
    this.side.set(side);
    this.left.set(cx - side / 2);
    this.top.set(cy - side / 2);
    this.clamp();
    this.emit();
  }

  down(e: PointerEvent) {
    if (!this.ready()) return;
    this.frame().nativeElement.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.pinch = this.distance();
  }
  move(e: PointerEvent) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const d = this.distance();
      if (this.pinch) this.setZoom(this.zoom() * d / this.pinch);
      this.pinch = d;
      return;
    }
    const perPx = this.side() / this.view();
    this.left.update(l => l - (e.clientX - prev.x) * perPx);
    this.top.update(t => t - (e.clientY - prev.y) * perPx);
    this.clamp();
    this.emit();
  }
  up(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    this.pinch = this.distance();
  }
  wheel(e: WheelEvent) {
    if (!this.ready()) return;
    e.preventDefault();
    this.setZoom(this.zoom() * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  }

  private distance() {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
  private clamp() {
    const side = Math.min(this.short(), Math.max(this.short() / 4, this.side()));
    this.side.set(side);
    this.left.set(Math.min(this.w() - side, Math.max(0, this.left())));
    this.top.set(Math.min(this.h() - side, Math.max(0, this.top())));
  }
  private emit() {
    if (!this.w()) return;
    this.cropChange.emit({ x: this.left() / this.w(), y: this.top() / this.h(), size: this.side() / this.w() });
  }
}

/** CSS transform that shows the same square in a box of `box` px (for previews). */
export function cropStyle(c: Crop | null, w: number, h: number, box: number) {
  if (!c || !w) return '';
  const s = box / (c.size * w);
  return `translate(${-c.x * w * s}px, ${-c.y * h * s}px) scale(${s})`;
}
