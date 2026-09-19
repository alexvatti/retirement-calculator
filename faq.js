/* ============================================================
   FAQ & Guidelines page — accordion behaviour
   ============================================================ */

(function () {
  "use strict";

  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach(function (item) {
    const trigger = item.querySelector(".faq-trigger");
    const panel = item.querySelector(".faq-panel");
    const icon = item.querySelector(".faq-icon");
    if (!trigger || !panel) return;

    trigger.addEventListener("click", function () {
      const isOpen = item.classList.contains("open");

      // Close any other open FAQ item (single-open accordion)
      faqItems.forEach(function (other) {
        if (other !== item && other.classList.contains("open")) {
          other.classList.remove("open");
          other.querySelector(".faq-trigger").setAttribute("aria-expanded", "false");
          other.querySelector(".faq-icon").textContent = "+";
          other.querySelector(".faq-panel").style.maxHeight = null;
        }
      });

      if (isOpen) {
        item.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
        if (icon) icon.textContent = "+";
        panel.style.maxHeight = null;
      } else {
        item.classList.add("open");
        trigger.setAttribute("aria-expanded", "true");
        if (icon) icon.textContent = "+";
        panel.style.maxHeight = panel.scrollHeight + "px";
      }
    });
  });

  // Keep open panels correctly sized if the window is resized
  window.addEventListener("resize", function () {
    document.querySelectorAll(".faq-item.open .faq-panel").forEach(function (panel) {
      panel.style.maxHeight = panel.scrollHeight + "px";
    });
  });
})();
