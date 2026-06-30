(function () {
  "use strict";

  var STORAGE_KEY = "jsa_bonus_kickoff_seen";

  function shouldSkipAnimation() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function markAnimationSeen() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch (error) {
      return;
    }
  }

  function closeOverlay(overlay) {
    markAnimationSeen();
    overlay.classList.add("is-hidden");
    window.setTimeout(function () {
      overlay.remove();
    }, 460);
  }

  function initBonusKickoff() {
    var overlay = document.getElementById("bonus-kickoff");

    if (!overlay) {
      return;
    }

    if (shouldSkipAnimation()) {
      overlay.remove();
      return;
    }

    var bonusButton = overlay.querySelector("a");
    var closeButton = overlay.querySelector("[data-bonus-close]");

    if (bonusButton) {
      bonusButton.addEventListener("click", markAnimationSeen);
    }

    if (closeButton) {
      closeButton.addEventListener("click", function () {
        closeOverlay(overlay);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", initBonusKickoff);
}());
