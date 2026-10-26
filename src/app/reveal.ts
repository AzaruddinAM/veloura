import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

@Directive({ selector: '[reveal]' })
export class Reveal {
  constructor() {
    const el = inject(ElementRef).nativeElement as HTMLElement;
    el.classList.add('rv');
    if (typeof IntersectionObserver === 'undefined') { el.classList.add('in'); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('in'); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el);
    inject(DestroyRef).onDestroy(() => io.disconnect());
  }
}
