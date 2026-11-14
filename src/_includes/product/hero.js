import { esc } from "./lib.js";

export function renderHero(p) {
  const h = p.hero || {};
  return `<section id="hero" class="fade-up">
  <div class="hero-wrapper">
    <img src="${esc(h.image)}"
         alt="${esc(h.alt || "")}"
         class="hero-cover">

    <div class="hero-text ec-hero__text">
      <h1 class="hero-line hero-line-1">
        <span class="shifted">${esc(h.title)}</span>
      </h1>
      ${h.headline ? `<${h.headline_tag || "h1"} class="hero-line hero-line-2">${esc(h.headline)}</${h.headline_tag || "h1"}>` : ""}
      ${h.sub ? `<p class="hero-sub hero-line hero-line-3">
        ${esc(h.sub)}
      </p>` : ""}
      ${h.br === false ? "" : "<br>"}
    </div>
  </div>
</section>`;
}
