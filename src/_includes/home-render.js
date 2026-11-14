import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: true, breaks: false });
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function card(c) {
  const link = c.link ? ` onclick="window.location.href='${esc(c.link)}'"` : "";
  const pointer = c.link ? ` style="cursor:pointer"` : "";
  const action =
    c.button_action === "booking" ? "openBookingModal(event)" : "openPricePopup(event)";
  const heading = (c.heading || c.title).toLocaleUpperCase("uk");
  const button =
    c.button_action === "none"
      ? ""
      : `<div class="buttons-row">
            <button class="price-btn" onclick="event.stopPropagation(); ${action}">${esc(c.button_label || "Записатися")}</button>
          </div>`;
  return `
    <div class="card scroll-animate"${link}
         data-product="${esc(c.title)}"
         data-price="${esc(c.price || "")}"
         data-pay-link="${esc(c.pay_link || "")}"
         data-send-email="${c.send_email === false ? "false" : "true"}"
         data-email-template="${esc(c.email_template || "free")}"
         data-redirect="${c.redirect ? "true" : "false"}"${pointer}>
      <img src="${esc(c.image)}" alt="${esc(c.title)}" />
      <div class="card-content">
        <div class="card-text-content">
          <h3 class="card-title">${esc(heading)}</h3>
          ${md.render(c.description || "")}
        </div>
        <div class="card-bottom">
          ${c.link ? '<div class="readmore">Читати далі →</div>' : "<div></div>"}
          ${button}
        </div>
      </div>
    </div>`;
}

function section(s) {
  return `<section class="section" id="${esc(s.id)}">
  <h2 class="products-header fade-up">${esc(s.title)}</h2>
  ${s.subtitle ? `<h3 class="products-header products-subtitle fade-up">${esc(s.subtitle)}</h3>` : ""}
  <div class="cards">${(s.cards || []).map(card).join("\n")}
  </div>
</section>`;
}


export function renderSections(home) {
  return (home.sections || []).map(section).join("\n\n");
}

export function renderSection(s) {
  return section(s);
}
