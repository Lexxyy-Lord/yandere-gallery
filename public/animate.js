// Animasi fade in pakai IntersectionObserver
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("fade-in");
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".gallery img").forEach(img => {
    observer.observe(img);
  });
});
