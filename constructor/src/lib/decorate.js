// Панелі керування прямо на сторінці-перегляді: підключаються до DOM того самого iframe (same-origin).

const mkBtn = (doc, label, title, fn) => {
  const b = doc.createElement("button");
  b.type = "button";
  b.textContent = label;
  if (title) b.title = title;
  b.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    fn();
  });
  return b;
};
const toolbar = (doc, host, buttons) => {
  const t = doc.createElement("div");
  t.className = "__tb";
  buttons.forEach(([l, fn, ti]) => t.appendChild(mkBtn(doc, l, ti, fn)));
  host.appendChild(t);
  return t;
};
const addBtn = (doc, text, fn) => {
  const b = mkBtn(doc, text, "", fn);
  b.className = "__add";
  return b;
};
const noLinks = (doc) =>
  doc.addEventListener("click", (ev) => {
    if (ev.target.closest && ev.target.closest("a")) ev.preventDefault();
  }, true);

export function markSelected(doc, selected) {
  doc.querySelectorAll(".__bw").forEach((w) => w.classList.toggle("sel", selected !== null && selected !== undefined && w.getAttribute("data-i") === String(selected)));
}

/** Знаходить вставки за коментарями <!--ins:N--> і вішає на елемент посилання на дані. */
function markInserts(doc, inserts) {
  const w = doc.createTreeWalker(doc.body, 128 /* NodeFilter.SHOW_COMMENT */);
  let n;
  while ((n = w.nextNode())) {
    const m = /^ins:(\d+)$/.exec(n.data);
    if (!m) continue;
    let el = n.nextSibling;
    while (el && el.nodeType !== 1) el = el.nextSibling;
    if (el) {
      el.classList.add("__ins");
      el._it = inserts[+m[1]];
    }
  }
}

function insertTools(doc, c) {
  const ft = doc.createElement("div");
  ft.className = "__tb __ins-tb";
  ft.style.cssText = "position:absolute;display:none;z-index:100000;gap:4px";
  doc.body.appendChild(ft);

  function place(el) {
    const it = el._it;
    if (!it) return;
    const bw = el.closest(".__bw");
    const bi = bw ? Number(bw.getAttribute("data-i")) : -1;
    ft.innerHTML = "";
    [
      [`✎ ${c.insertLabel(it)}`, () => c.onEditInsert(it, bi)],
      ["↑", () => c.onMoveInsert(it, -1)],
      ["↓", () => c.onMoveInsert(it, 1)],
      ["🗑", () => c.onDelInsert(it), "Видалити вставку"],
    ].forEach(([l, fn, ti]) => ft.appendChild(mkBtn(doc, l, ti, fn)));
    ft.style.display = "flex";
    // Спочатку показуємо, щоб дізнатися реальну ширину панелі
    const r = el.getBoundingClientRect();
    const v = doc.defaultView;
    const scrollY = v?.scrollY || 0;
    const scrollX = v?.scrollX || 0;
    const fw = ft.offsetWidth || 180;
    const fh = ft.offsetHeight || 32;
    // Над вставкою, по лівому краю; якщо не влазить — зсуваємо вліво
    let top = r.top + scrollY - fh - 6;
    if (top < scrollY + 4) top = r.bottom + scrollY + 6;
    let left = r.left + scrollX;
    const maxL = scrollX + (v?.innerWidth || 800) - fw - 8;
    if (left > maxL) left = Math.max(scrollX + 4, maxL);
    ft.style.top = top + "px";
    ft.style.left = left + "px";
  }

  doc.addEventListener("mouseover", (ev) => {
    const el = ev.target.closest && ev.target.closest(".__ins");
    if (!el) {
      if (!(ev.target.closest && ev.target.closest(".__ins-tb"))) ft.style.display = "none";
      return;
    }
    place(el);
  });
  // Клік по вставці одразу відкриває редагування (не треба шукати дрібну кнопку)
  doc.addEventListener("click", (ev) => {
    const el = ev.target.closest && ev.target.closest(".__ins");
    if (!el || !el._it) return;
    if (ev.target.closest(".__tb")) return;
    ev.preventDefault();
    ev.stopPropagation();
    const bw = el.closest(".__bw");
    const bi = bw ? Number(bw.getAttribute("data-i")) : -1;
    c.onEditInsert(el._it, bi);
  });
}

export function decoratePage(doc, c) {
  noLinks(doc);
  const ws = [...doc.querySelectorAll(".__bw")];
  const blocks = ws.filter((w) => w.getAttribute("data-i") !== "hero");
  ws.forEach((w) => {
    const key = w.getAttribute("data-i");
    if (key === "hero") {
      toolbar(doc, w, [["⚙ Налаштування сторінки", () => c.onSelect("hero")]]);
      w.addEventListener("click", (ev) => {
        if (!ev.target.closest(".__tb")) c.onSelect("hero");
      });
      return;
    }
    const i = Number(key);
    const btns = [[`✎ ${c.label(i)}`, () => c.onSelect(i)]];
    if (c.hasInserts(i)) btns.push(["＋ Вставка", () => c.onAddInsert(i), "Додати вставку в цей блок"]);
    btns.push(["↑", () => c.onMove(i, -1)], ["↓", () => c.onMove(i, 1)], ["⧉", () => c.onDup(i), "Дублювати"], ["🗑", () => c.onDel(i), "Видалити"]);
    toolbar(doc, w, btns);
    w.addEventListener("click", (ev) => {
      if (!ev.target.closest(".__tb,.__add")) c.onSelect(i);
    });
    w.parentNode.insertBefore(addBtn(doc, "＋ Додати блок тут", () => c.onAddAt(i)), w);
  });
  const last = blocks[blocks.length - 1] || ws[ws.length - 1];
  const end = addBtn(doc, "＋ Додати блок", () => c.onAddAt(blocks.length));
  if (last) last.after(end);
  else doc.body.append(end);
  markInserts(doc, c.inserts);
  insertTools(doc, c);
}

export function decorateHome(doc, c) {
  noLinks(doc);
  const wraps = [...doc.querySelectorAll(".__bw")];
  wraps.forEach((w) => {
    const si = Number(w.getAttribute("data-i"));
    toolbar(doc, w, [
      ["✎ Розділ", () => c.onSelect(si)],
      ["↑", () => c.onMoveSection(si, -1)],
      ["↓", () => c.onMoveSection(si, 1)],
      ["🗑", () => c.onDelSection(si), "Видалити розділ"],
    ]);
    w.addEventListener("click", (ev) => {
      if (!ev.target.closest(".__tb,.__add,.card")) c.onSelect(si);
    });
    const cards = [...w.querySelectorAll(".card")];
    cards.forEach((el, ci) => {
      el.classList.add("__b");
      el.setAttribute("draggable", "true");
      el._ref = { si, ci };
      // Картинки і кнопки не повинні запускати нативний drag (інакше червоний 🚫)
      el.querySelectorAll("img, button, a").forEach((n) => {
        n.setAttribute("draggable", "false");
        n.addEventListener("dragstart", (e) => e.preventDefault());
      });
      toolbar(doc, el, [
        ["✎", () => c.onEditCard(si, ci), "Редагувати картку"],
        ["🗑", () => c.onDelCard(si, ci), "Видалити картку"],
      ]);
    });
    (w.querySelector(".cards") || w).appendChild(addBtn(doc, "＋ Додати картку", () => c.onAddCard(si)));
  });

  // Перетягування карток між розділами (і всередині)
  let drag = null;
  const clear = () => {
    doc.querySelectorAll(".__over,.__card-over").forEach((x) => {
      x.classList.remove("__over", "__card-over");
    });
  };
  doc.addEventListener("dragstart", (ev) => {
    const el = ev.target.closest && ev.target.closest(".card");
    if (!el || !el._ref) return;
    // не тягнемо, якщо клікнули по кнопках панелі
    if (ev.target.closest && ev.target.closest(".__tb")) {
      ev.preventDefault();
      return;
    }
    drag = el._ref;
    el.classList.add("__dragging");
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", "card");
      // прозорий ghost, щоб не перекривав drop-зони в деяких WebView
      try {
        const ghost = el.cloneNode(true);
        ghost.style.cssText = "position:absolute;top:-9999px;width:" + el.offsetWidth + "px;opacity:.85";
        doc.body.appendChild(ghost);
        ev.dataTransfer.setDragImage(ghost, 40, 20);
        setTimeout(() => ghost.remove(), 0);
      } catch (_) {}
    }
  });
  const accept = (ev) => {
    if (!drag) return null;
    const w = ev.target.closest && ev.target.closest(".__bw");
    if (!w) return null;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
    return w;
  };
  doc.addEventListener("dragenter", (ev) => {
    const w = accept(ev);
    if (!w) return;
    clear();
    w.classList.add("__over");
    const card = ev.target.closest && ev.target.closest(".card");
    if (card && card._ref) card.classList.add("__card-over");
  });
  doc.addEventListener("dragover", (ev) => {
    const w = accept(ev);
    if (!w) return;
    clear();
    w.classList.add("__over");
    const card = ev.target.closest && ev.target.closest(".card");
    if (card && card._ref) card.classList.add("__card-over");
  });
  doc.addEventListener("drop", (ev) => {
    if (!drag) return;
    const w = ev.target.closest && ev.target.closest(".__bw");
    if (!w) return;
    ev.preventDefault();
    const tgt = ev.target.closest && ev.target.closest(".card");
    const toSi = Number(w.getAttribute("data-i"));
    const toCi = tgt && tgt._ref && !(tgt.classList.contains("__dragging")) ? tgt._ref.ci : null;
    c.onMoveCard(drag, { si: toSi, ci: toCi });
    drag = null;
    clear();
    doc.querySelectorAll(".__dragging").forEach((x) => x.classList.remove("__dragging"));
  });
  doc.addEventListener("dragend", () => {
    drag = null;
    clear();
    doc.querySelectorAll(".__dragging").forEach((x) => x.classList.remove("__dragging"));
  });
}
