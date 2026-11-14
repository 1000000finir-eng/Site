  <!--=======================================
       UP button — як на головній
       ======================================-->
  <button class="scroll-top" onclick="scrollToTop()" aria-label="Наверх">
    <img src="/assets/icons/up-arrow.png" alt="up">
  </button>

  <!--=================================================================
     Footer & offer button
       ==============================================================-->
  <div class="offer-section">
  <button class="offer-button" onclick="openOfferModal()">Договір оферти</button>
</div>

<footer>
  <div class="c">
    <div class="social">
      <a href="https://instagram.com/stetsurina.irina_coach" target="_blank">
        <img src="/assets/icons/instagram-gray.png" class="gray" alt="Instagram">
        <img src="/assets/icons/instagram.png" class="color" alt="Instagram">
      </a>
      <a href="https://facebook.com/IrenStetsurina" target="_blank">
        <img src="/assets/icons/facebook-gray.png" class="gray" alt="Facebook">
        <img src="/assets/icons/facebook.png" class="color" alt="Facebook">
      </a>
      <a href="https://t.me/Stec0407" target="_blank">
        <img src="/assets/icons/telegram-gray.png" class="gray" alt="Telegram">
        <img src="/assets/icons/telegram.png" class="color" alt="Telegram">
      </a>
    </div>
    <div>ФОП Стецуріна Ірина Олександрівна © • м. Київ, Україна • <span id="year"></span></div>
  </div>
    <div class="footer-privacy-stick">
  <button class="offer-button privacy-button" onclick="openPrivacyModal()">
    Політика конфіденційності
  </button>
</div>
</footer>


<!-- =========================================================
     CONTACTS MODAL
========================================================= -->
<div id="contactsModal">
  <div class="contacts-modal-content">
    <button class="modal-x" aria-label="Закрити" onclick="closeContactsModal()"><span>&times;</span></button>
    <h3>
      <img src="/assets/icons/phone.png" alt="Телефон">
      Контакти
    </h3>
    <p class="contact-name">ФОП Стецуріна Ірина Олександрівна</p>
    <p class="location">Україна, м. Київ</p>

    <div class="contacts-socials">
      <a href="https://ig.me/m/stetsurina.irina_coach" target="_blank" rel="noopener">
        <img src="/assets/icons/instagram-gray.png" class="gray" alt="Instagram">
        <img src="/assets/icons/instagram.png" class="color" alt="Instagram">
      </a>
      <a href="https://www.facebook.com/IrenStetsurina" target="_blank" rel="noopener">
        <img src="/assets/icons/facebook-gray.png" class="gray" alt="Facebook">
        <img src="/assets/icons/facebook.png" class="color" alt="Facebook">
      </a>
      <a href="https://t.me/Stec0407" target="_blank" rel="noopener">
        <img src="/assets/icons/telegram-gray.png" class="gray" alt="Telegram">
        <img src="/assets/icons/telegram.png" class="color" alt="Telegram">
      </a>
    </div>
  </div>
</div>

<!-- =========================================================
     CALLBACK MODAL
========================================================= -->
<div id="callbackModal">
  <div class="popup-content">
    <button class="modal-x" aria-label="Закрити" onclick="closeCallbackModal()"><span>&times;</span></button>

    <div class="popup-head">
      <h3 class="callback-title">
        <span class="callback-title-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path fill="currentColor" fill-opacity="0" stroke-dasharray="62" d="M8 3c0.5 0 2.5 4.5 2.5 5c0 1 -1.5 2 -2 3c-0.5 1 0.5 2 1.5 3c0.39 0.39 2 2 3 1.5c1 -0.5 2 -2 3 -2c0.5 0 5 2 5 2.5c0 2 -1.5 3.5 -3 4c-1.5 0.5 -2.5 0.5 -4.5 0c-2 -0.5 -3.5 -1 -6 -3.5c-2.5 -2.5 -3 -4 -3.5 -6c-0.5 -2 -0.5 -3 0 -4.5c0.5 -1.5 2 -3 4 -3Z"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.6s" values="62;0"/><animateTransform attributeName="transform" dur="2.7s" keyTimes="0;0.035;0.07;0.105;0.14;0.175;0.21;0.245;0.28;1" repeatCount="indefinite" type="rotate" values="0 12 12;15 12 12;0 12 12;-12 12 12;0 12 12;12 12 12;0 12 12;-15 12 12;0 12 12;0 12 12"/><animate fill="freeze" attributeName="fill-opacity" begin="1.3s" dur="0.4s" to="1"/></path><g fill="none"><path stroke-dasharray="6" stroke-dashoffset="6" d="M15.76 8.28c-0.5 -0.51 -1.1 -0.93 -1.76 -1.24M15.76 8.28c0.49 0.49 0.9 1.08 1.2 1.72"><animate attributeName="stroke-dashoffset" begin="0.7s" dur="2.7s" keyTimes="0;0.15;0.3;1" repeatCount="indefinite" values="6;0;6;6"/></path><path stroke-dasharray="8" stroke-dashoffset="8" d="M18.67 5.35c-1 -1 -2.26 -1.73 -3.67 -2.1M18.67 5.35c0.99 1 1.72 2.25 2.08 3.65"><animate attributeName="stroke-dashoffset" begin="1s" dur="2.7s" keyTimes="0;0.15;0.3;1" repeatCount="indefinite" values="8;0;8;8"/></path></g></g></svg>
        </span>
        Зворотній дзвінок
      </h3>
      <p class="callback-subtitle">Залиште контакти і я вам передзвоню</p>
    </div>

    <div class="popup-body">
      <div class="required-field field has-icon">
        <span class="field-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M9.175 10.825Q8 9.65 8 8t1.175-2.825T12 4t2.825 1.175T16 8t-1.175 2.825T12 12t-2.825-1.175M4 20v-2.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2V20z"/></svg>
        </span>
        <input type="text" id="callbackName" placeholder="Ваше ім'я" required autocomplete="name">
      </div>

      <div class="required-field field has-icon">
        <span class="field-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path fill="currentColor" fill-opacity="0" stroke-dasharray="62" d="M8 3c0.5 0 2.5 4.5 2.5 5c0 1 -1.5 2 -2 3c-0.5 1 0.5 2 1.5 3c0.39 0.39 2 2 3 1.5c1 -0.5 2 -2 3 -2c0.5 0 5 2 5 2.5c0 2 -1.5 3.5 -3 4c-1.5 0.5 -2.5 0.5 -4.5 0c-2 -0.5 -3.5 -1 -6 -3.5c-2.5 -2.5 -3 -4 -3.5 -6c-0.5 -2 -0.5 -3 0 -4.5c0.5 -1.5 2 -3 4 -3Z"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.6s" values="62;0"/><animateTransform attributeName="transform" dur="2.7s" keyTimes="0;0.035;0.07;0.105;0.14;0.175;0.21;0.245;0.28;1" repeatCount="indefinite" type="rotate" values="0 12 12;15 12 12;0 12 12;-12 12 12;0 12 12;12 12 12;0 12 12;-15 12 12;0 12 12;0 12 12"/><animate fill="freeze" attributeName="fill-opacity" begin="1.3s" dur="0.4s" to="1"/></path><g fill="none"><path stroke-dasharray="6" stroke-dashoffset="6" d="M15.76 8.28c-0.5 -0.51 -1.1 -0.93 -1.76 -1.24M15.76 8.28c0.49 0.49 0.9 1.08 1.2 1.72"><animate attributeName="stroke-dashoffset" begin="0.7s" dur="2.7s" keyTimes="0;0.15;0.3;1" repeatCount="indefinite" values="6;0;6;6"/></path><path stroke-dasharray="8" stroke-dashoffset="8" d="M18.67 5.35c-1 -1 -2.26 -1.73 -3.67 -2.1M18.67 5.35c0.99 1 1.72 2.25 2.08 3.65"><animate attributeName="stroke-dashoffset" begin="1s" dur="2.7s" keyTimes="0;0.15;0.3;1" repeatCount="indefinite" values="8;0;8;8"/></path></g></g></svg>
        </span>
        <input type="text" id="callbackPhone" placeholder="Телефон" required autocomplete="tel">
      </div>

      <button class="btn btn-main" onclick="submitCallback()">
        Замовити дзвінок
      </button>

      <div id="callbackStatus"></div>
    </div>
  </div>
</div>

<!-- =========================================================
     BOOKING MODAL
========================================================= -->
<div id="bookingModal" class="booking-modal">
  <div class="booking-modal-content">
    <button class="modal-x" aria-label="Закрити" onclick="closeBookingModal()"><span>&times;</span></button>
    <div id="bookingContainer"></div>
  </div>
</div>

<!-- =========================================================
     PRIVACY
========================================================= -->
<div id="offerModal" class="offer-modal">
  <div class="offer-modal-content">
    <div id="offerContent"></div>
  </div>
</div>

<script>
/* Експрес-консультація: поява блоків при прокрутці як на головній */
(function () {
  function initExpressReveal() {
    const blocks = document.querySelectorAll('.ec-animate');
    if (!blocks.length || !('IntersectionObserver' in window)) {
      blocks.forEach(b => b.classList.add('ec-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const block = entry.target;
        block.classList.add('ec-visible');
        const heading = block.querySelector('.ec-section-heading');
        if (heading) heading.classList.add('ec-content-visible');

        const children = Array.from(block.children).filter(el => !el.classList.contains('ec-section-heading'));
        children.forEach((el, index) => {
          setTimeout(() => el.classList.add('ec-content-visible'), 140 + index * 120);
        });
        obs.unobserve(block);
      });
    }, { threshold: 0.10, rootMargin: '0px 0px -8%' });

    blocks.forEach(block => observer.observe(block));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExpressReveal);
  } else {
    initExpressReveal();
  }
})();
</script>

<script src="/script-safe.js"></script>
<script src="/booking/booking.js" defer></script>
