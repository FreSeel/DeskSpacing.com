document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#probootstrap-loader')?.classList.remove('show');
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  if (document.querySelector('.probootstrap-scene-0')) {
    gsap
      .timeline({
        scrollTrigger: {
          trigger: '.probootstrap-scene-0',
          start: 'top center',
          once: true,
        },
      })
      .from('.probootstrap-device-vertical-1', {
        duration: 1,
        x: -100,
        autoAlpha: 0,
        ease: 'power4.out',
      })
      .from(
        '.probootstrap-cover .probootstrap-stagger',
        {
          duration: 1,
          autoAlpha: 0,
          x: -100,
          scale: 0.95,
          delay: 0.2,
          ease: 'power4.out',
          stagger: 0.2,
        },
        '-=0.8',
      );
  }

  if (document.querySelector('.probootstrap-scene-1')) {
    gsap
      .timeline({
        scrollTrigger: {
          trigger: '.probootstrap-scene-1',
          start: 'top center',
          once: true,
        },
      })
      .from('.probootstrap-device-center', {
        duration: 0.5,
        autoAlpha: 0,
        y: 100,
        ease: 'power4.in',
      })
      .from(
        '.probootstrap-device-left',
        { duration: 0.5, autoAlpha: 0, x: 200, delay: 0.2, ease: 'power4.in' },
        '-=0.5',
      )
      .from(
        '.probootstrap-device-right',
        { duration: 0.5, autoAlpha: 0, x: -200, delay: 0.2, ease: 'power4.in' },
        '-=0.7',
      );
  }
});
