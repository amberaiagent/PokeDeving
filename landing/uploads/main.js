// current year
document.getElementById("yr").textContent = new Date().getFullYear();

// scroll-reveal: fade sections/cards in as they enter the viewport
const revealEls = document.querySelectorAll(
  ".about__body, .loop li, .drop__head, .tier, .game__text, .game__char, .token__head, .donut, .lg"
);
revealEls.forEach(el => el.classList.add("reveal"));

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  revealEls.forEach(el => io.observe(el));
} else {
  revealEls.forEach(el => el.classList.add("in"));
}
