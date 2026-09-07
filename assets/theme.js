/* Rally theme toggle — Light / Auto / Dark, mirroring the app's
   ThemeModeToggle. Persists the user's explicit choice in localStorage;
   "Auto" clears the override and defers to prefers-color-scheme. */
(function () {
  var KEY = 'rally-theme';

  var SUN_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2' +
    'M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
  var MOON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a' +
    '6.5 6.5 0 0 0 10.5 10.5Z"/></svg>';

  function getStored() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function setStored(theme) {
    try {
      if (theme) localStorage.setItem(KEY, theme);
      else localStorage.removeItem(KEY);
    } catch (e) {}
  }

  function apply(theme) {
    var root = document.documentElement;
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme');
    }
  }

  function systemPrefersDark() {
    return (
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }

  function isDark(theme) {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return systemPrefersDark();
  }

  function init() {
    var toggleBtn = document.getElementById('theme-toggle');
    var panel = document.getElementById('theme-panel');
    if (!toggleBtn || !panel) return;

    var track = panel.querySelector('.theme-track');
    var glyph = panel.querySelector('.theme-glyph');
    var options = Array.prototype.slice.call(
      panel.querySelectorAll('[data-theme-choice]')
    );
    var current = getStored(); // 'light' | 'dark' | null (= auto)

    function optionFor(choice) {
      return options.filter(function (o) {
        return o.getAttribute('data-theme-choice') === choice;
      })[0];
    }

    function updateIcon() {
      toggleBtn.innerHTML = isDark(current) ? MOON_SVG : SUN_SVG;
    }

    function updateSelectedStates() {
      var choice = current || 'system';
      options.forEach(function (btn) {
        btn.classList.toggle(
          'is-selected',
          btn.getAttribute('data-theme-choice') === choice
        );
      });
    }

    function positionGlyph(animate) {
      var target = optionFor(current || 'system');
      if (!target || !glyph || !track) return;
      var trackRect = track.getBoundingClientRect();
      var targetRect = target.getBoundingClientRect();
      var x = targetRect.left - trackRect.left + targetRect.width / 2 - 10;
      glyph.style.transition = animate
        ? 'left .35s cubic-bezier(.34,1.15,.4,1)'
        : 'none';
      glyph.style.left = x + 'px';
      glyph.innerHTML = isDark(current) ? MOON_SVG : SUN_SVG;
    }

    function openPanel() {
      panel.hidden = false;
      toggleBtn.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function () {
        positionGlyph(false);
      });
    }

    function closePanel() {
      panel.hidden = true;
      toggleBtn.setAttribute('aria-expanded', 'false');
    }

    options.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var choice = btn.getAttribute('data-theme-choice');
        current = choice === 'system' ? null : choice;
        setStored(current);
        apply(current);
        updateIcon();
        updateSelectedStates();
        positionGlyph(true);
        setTimeout(closePanel, 200);
      });
    });

    toggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panel.hidden) openPanel();
      else closePanel();
    });

    document.addEventListener('click', function (e) {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== toggleBtn) {
        closePanel();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) closePanel();
    });

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener(
        'change',
        function () {
          if (!current) {
            updateIcon();
            if (!panel.hidden) positionGlyph(true);
          }
        }
      );
    }

    updateIcon();
    updateSelectedStates();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
