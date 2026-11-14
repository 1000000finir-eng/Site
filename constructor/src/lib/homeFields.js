// Поля картки на головній (спільні для форми розділу).
const S = (name, label, extra = {}) => ({ kind: "string", name, label, ...extra });
const EMAIL = [{ value: "free", label: "Безкоштовна послуга" }, { value: "paid", label: "Платна послуга" }];

export function cardFields(pages) {
  const links = [{ value: "", label: "— без сторінки —" }, ...pages.map((p) => ({ value: `/${p.slug}/`, label: p.title }))];
  return [
    S("title", "Назва послуги"),
    { kind: "image", name: "image", label: "Картинка" },
    { kind: "md", name: "description", label: "Короткий опис", hint: "Виділіть слова жирним — так буде і на сайті." },
    { kind: "select", name: "link", label: "Сторінка послуги", options: links },
    { kind: "select", name: "button_action", label: "Що робить кнопка", options: [{ value: "price", label: "Відкриває форму запису" }, { value: "booking", label: "Відкриває календар бронювання" }, { value: "none", label: "Без кнопки" }] },
    S("button_label", "Текст кнопки", { optional: true }),
    S("price", "Ціна (напр. 1500 ₴)", { optional: true }),
    S("pay_link", "Посилання на оплату WayForPay", { optional: true }),
    { kind: "select", name: "email_template", label: "Лист клієнту", options: EMAIL },
    { kind: "bool", name: "send_email", label: "Надсилати лист клієнту" },
    { kind: "bool", name: "redirect", label: "Після заявки переходити на оплату", advanced: true },
    S("heading", "Заголовок на картці, якщо відрізняється від назви", { optional: true, advanced: true }),
  ];
}
export const SECTION_FIELDS = [S("id", "Якір розділу (латиницею, для посилання /#id)", { advanced: true }), S("title", "Заголовок розділу"), S("subtitle", "Підзаголовок розділу", { optional: true })];
