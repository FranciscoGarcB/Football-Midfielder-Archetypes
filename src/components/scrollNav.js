// Highlights the active nav link as the user scrolls between sections.
// Uses IntersectionObserver to avoid scroll event listeners.

const ScrollNavComponent = (() => {

  function init() {
    const links    = document.querySelectorAll(".nav-link[data-section]");
    const sections = document.querySelectorAll(".viz-section[id]");
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            links.forEach(l => l.classList.toggle("active", l.dataset.section === id));
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );

    sections.forEach(s => observer.observe(s));
  }

  return { init };
})();

window.ScrollNavComponent = ScrollNavComponent;
