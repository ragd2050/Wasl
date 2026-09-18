/* ===== WASL shared enhancement layer ===== */
(function () {
  "use strict";
  var KEY = "waslSettings";
  var pageName = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/i, "");
  document.documentElement.classList.add("wasl-page-" + pageName);
  var S = { lang: null, scale: 1, contrast: false, motion: false, tts: false, voiceURI: "" };
  var voices = [];
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) S = Object.assign(S, JSON.parse(raw));
  } catch (e) {}
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) {}
  }
  var AR = (document.documentElement.lang || "ar").indexOf("en") === -1;
  function curLang() {
    return S.lang || (document.documentElement.dir === "ltr" ? "en" : "ar");
  }
  function t(a, e) {
    return curLang() === "ar" ? a : e;
  }

  /* ---- selected appointment / patient ---- */
  function selectedPatient() {
    try {
      return JSON.parse(localStorage.getItem("waslSelectedPatient") || "null");
    } catch (e) {
      return null;
    }
  }

  function applySelectedPatient(root) {
    var patient = selectedPatient();
    if (!patient || !patient.name_ar || !patient.name_en) return;
    var firstAr = patient.name_ar.trim().split(/\s+/)[0];
    var firstEn = patient.name_en.trim().split(/\s+/)[0];
    var replacements = [
      ["سارة عبدالله العتيبي", patient.name_ar],
      ["Sara Abdullah Al-Otaibi", patient.name_en],
      ["Sara's", firstEn + "'s"],
      ["سارة", firstAr],
      ["Sara", firstEn]
    ];

    function replaceValue(value) {
      if (!value) return value;
      replacements.forEach(function (pair) {
        value = value.split(pair[0]).join(pair[1]);
      });
      return value;
    }

    var scope = root || document.body;
    if (!scope) return;
    var elements = [];
    if (scope.nodeType === 1) elements.push(scope);
    if (scope.querySelectorAll) elements = elements.concat(Array.from(scope.querySelectorAll("*")));
    elements.forEach(function (el) {
      // Preserve the logged-in employee name shown in the site header.
      if (el.closest && el.closest("header .user, header .user-text")) return;
      ["data-ar", "data-en", "aria-label", "title", "placeholder"].forEach(function (attr) {
        if (el.hasAttribute && el.hasAttribute(attr)) el.setAttribute(attr, replaceValue(el.getAttribute(attr)));
      });
      Array.from(el.childNodes || []).forEach(function (node) {
        if (node.nodeType === 3 && node.nodeValue && node.nodeValue.trim()) {
          node.nodeValue = replaceValue(node.nodeValue);
        }
      });
    });

    document.querySelectorAll(".patient-avatar text").forEach(function (el) {
      if (el.closest("header")) return;
      el.setAttribute("data-ar", patient.initial_ar || firstAr.charAt(0));
      el.setAttribute("data-en", patient.initial_en || firstEn.charAt(0));
      el.textContent = curLang() === "ar" ? (patient.initial_ar || firstAr.charAt(0)) : (patient.initial_en || firstEn.charAt(0));
    });
  }

  /* ---- apply visual settings ---- */
  function applyScale() {
    document.documentElement.style.setProperty("--wasl-scale", S.scale);
  }
  function applyContrast() {
    document.documentElement.classList.toggle("wasl-contrast", !!S.contrast);
  }
  function applyMotion() {
    document.documentElement.classList.toggle("wasl-motion-off", !!S.motion);
  }
  applyScale();
  applyContrast();
  applyMotion();

  /* ---- language persistence: wrap page setLang ---- */
  var pageSetLang = window.setLang;
  function syncChrome() {
    var f = document.getElementById("waslFab");
    if (f) f.setAttribute("aria-label", t("خيارات الوصول", "Accessibility options"));
    updatePanelStates();
  }
  if (typeof pageSetLang === "function") {
    window.setLang = function (n) {
      pageSetLang(n);
      S.lang = n;
      save();
      refreshVoices();
      syncChrome();
    };
  }

  /* ---- build UI after DOM ready ---- */
  function build() {
    applySelectedPatient(document.body);
    /* skip link */
    var main = document.querySelector("main") || document.querySelector(".main,.workspace,.shell,.app,.wrap");
    if (main && !main.id) main.id = "waslMain";
    var skip = document.createElement("a");
    skip.className = "wasl-skip";
    skip.href = "#" + ((main && main.id) || "");
    skip.setAttribute("data-ar", "تخطَّ إلى المحتوى");
    skip.setAttribute("data-en", "Skip to content");
    skip.textContent = t("تخطَّ إلى المحتوى", "Skip to content");
    skip.onclick = function (ev) {
      if (main) {
        ev.preventDefault();
        main.setAttribute("tabindex", "-1");
        main.focus();
        main.scrollIntoView();
      }
    };
    document.body.insertBefore(skip, document.body.firstChild);

    /* offline banner */
    var ob = document.createElement("div");
    ob.className = "wasl-offline";
    ob.id = "waslOffline";
    ob.setAttribute("role", "status");
    ob.setAttribute("data-ar", "لا يوجد اتصال بالإنترنت — بعض الميزات قد لا تعمل.");
    ob.setAttribute("data-en", "You are offline — some features may not work.");
    ob.textContent = t(
      "لا يوجد اتصال بالإنترنت — بعض الميزات قد لا تعمل.",
      "You are offline — some features may not work.",
    );
    document.body.appendChild(ob);
    function netCheck() {
      ob.classList.toggle("show", !navigator.onLine);
    }
    window.addEventListener("online", netCheck);
    window.addEventListener("offline", netCheck);
    netCheck();

    /* FAB */
    var fab = document.createElement("button");
    fab.className = "wasl-fab";
    fab.id = "waslFab";
    fab.type = "button";
    fab.setAttribute("aria-haspopup", "dialog");
    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-label", t("خيارات الوصول", "Accessibility options"));
    fab.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="1.6"/><path d="M4 8h16M9 8l-1 12M15 8l1 12M12 8v5"/></svg>';
    document.body.appendChild(fab);

    /* Panel */
    var p = document.createElement("div");
    p.className = "wasl-panel";
    p.id = "waslPanel";
    p.setAttribute("role", "dialog");
    p.setAttribute("aria-modal", "false");
    p.setAttribute("aria-label", t("خيارات الوصول", "Accessibility options"));
    p.innerHTML =
      '<h4 data-ar="خيارات الوصول" data-en="Accessibility">خيارات الوصول</h4>' +
      '<p class="wp-sub" data-ar="عدّل العرض بما يناسبك." data-en="Adjust the display to suit you.">عدّل العرض بما يناسبك.</p>' +
      '<div class="wasl-row"><span data-ar="حجم الخط" data-en="Text size">حجم الخط</span>' +
      '<div class="wasl-seg" id="waslScale">' +
      '<button data-s="0.9" data-ar="ص" data-en="A-" title="أصغر">ص</button>' +
      '<button data-s="1" data-ar="ع" data-en="A" title="عادي">ع</button>' +
      '<button data-s="1.15" data-ar="ك" data-en="A+" title="أكبر">ك</button>' +
      '<button data-s="1.3" data-ar="كك" data-en="A++" title="الأكبر">كك</button>' +
      "</div></div>" +
      '<div class="wasl-row"><button class="wasl-toggle" id="waslContrast" aria-pressed="false"><span data-ar="تباين عالٍ" data-en="High contrast">تباين عالٍ</span><span class="sw"></span></button></div>' +
      '<div class="wasl-row"><button class="wasl-toggle" id="waslMotion" aria-pressed="false"><span data-ar="تقليل الحركة" data-en="Reduce motion">تقليل الحركة</span><span class="sw"></span></button></div>' +
      '<div class="wasl-row"><button class="wasl-toggle" id="waslTts" aria-pressed="false"><span data-ar="قراءة صوتية" data-en="Read aloud">قراءة صوتية</span><span class="sw"></span></button></div>' +
      '<div class="wasl-row wasl-voice-row"><label for="waslVoice" data-ar="صوت القراءة" data-en="Reading voice">صوت القراءة</label>' +
      '<select id="waslVoice" aria-label="صوت القراءة"></select>' +
      '<button class="wasl-voice-test" id="waslVoiceTest" type="button" data-ar="تجربة الصوت" data-en="Preview voice">تجربة الصوت</button></div>' +
      '<button class="wasl-reset" id="waslReset" data-ar="إعادة الضبط" data-en="Reset">إعادة الضبط</button>';
    document.body.appendChild(p);

    function openPanel(o) {
      p.classList.toggle("open", o);
      fab.setAttribute("aria-expanded", o ? "true" : "false");
      if (o) {
        var b = p.querySelector("button");
        b && b.focus();
      }
    }
    fab.onclick = function () {
      openPanel(!p.classList.contains("open"));
    };
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && p.classList.contains("open")) {
        openPanel(false);
        fab.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (p.classList.contains("open") && !p.contains(e.target) && e.target !== fab && !fab.contains(e.target))
        openPanel(false);
    });

    p.querySelectorAll("#waslScale button").forEach(function (b) {
      b.onclick = function () {
        S.scale = parseFloat(b.dataset.s);
        applyScale();
        save();
        updatePanelStates();
      };
    });
    document.getElementById("waslContrast").onclick = function () {
      S.contrast = !S.contrast;
      applyContrast();
      save();
      updatePanelStates();
    };
    document.getElementById("waslMotion").onclick = function () {
      S.motion = !S.motion;
      applyMotion();
      save();
      updatePanelStates();
    };
    document.getElementById("waslTts").onclick = function () {
      S.tts = !S.tts;
      save();
      updatePanelStates();
      if (S.tts) speakAuto();
      else stopSpeak();
    };
    document.getElementById("waslVoice").onchange = function (e) {
      S.voiceURI = e.target.value;
      save();
    };
    document.getElementById("waslVoiceTest").onclick = function () {
      waslSpeak(t("مرحبًا، سأقرأ لك التعليمات بصوت واضح.", "Hello, I will read the instructions clearly."));
    };
    document.getElementById("waslReset").onclick = function () {
      S.scale = 1;
      S.contrast = false;
      S.motion = false;
      S.tts = false;
      S.voiceURI = "";
      applyScale();
      applyContrast();
      applyMotion();
      save();
      updatePanelStates();
      stopSpeak();
    };

    updatePanelStates();
    refreshVoices();
    wireSpeakers();
    /* apply saved language last so panel text translates too */
    if (S.lang && typeof window.setLang === "function") {
      window.setLang(S.lang);
    } else if (S.lang) {
      document.documentElement.lang = S.lang;
      document.documentElement.dir = S.lang === "ar" ? "rtl" : "ltr";
    }
    syncChrome();

    // Questionnaire content is rendered after page load, so update new nodes too.
    var patientObserver = new MutationObserver(function (changes) {
      changes.forEach(function (change) {
        change.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) applySelectedPatient(node);
        });
      });
    });
    patientObserver.observe(document.body, { childList: true, subtree: true });
  }

  function updatePanelStates() {
    document.querySelectorAll("#waslScale button").forEach(function (b) {
      b.classList.toggle("on", parseFloat(b.dataset.s) === S.scale);
    });
    [
      ["waslContrast", S.contrast],
      ["waslMotion", S.motion],
      ["waslTts", S.tts],
    ].forEach(function (x) {
      var el = document.getElementById(x[0]);
      if (el) {
        el.classList.toggle("on", !!x[1]);
        el.setAttribute("aria-pressed", x[1] ? "true" : "false");
      }
    });
  }

  /* ---- Text to speech ---- */
  function voiceScore(v, lang) {
    var name = (v.name || "").toLowerCase();
    var score = 0;
    if ((v.lang || "").toLowerCase() === lang.toLowerCase()) score += 60;
    else if ((v.lang || "").toLowerCase().indexOf(lang.slice(0, 2).toLowerCase()) === 0) score += 35;
    if (v.localService) score += 8;
    if (/natural|neural|premium|enhanced/.test(name)) score += 25;
    if (lang.indexOf("ar") === 0 && /zariyah|hoda|laila|zeina|salma|majed|maged|hamed|tarik/.test(name)) score += 15;
    if (lang.indexOf("en") === 0 && /aria|jenny|samantha|ava|serena|daniel|guy/.test(name)) score += 15;
    return score;
  }
  function compatibleVoices() {
    var prefix = curLang() === "ar" ? "ar" : "en";
    return voices.filter(function (v) {
      return (v.lang || "").toLowerCase().indexOf(prefix) === 0;
    });
  }
  function selectedVoice() {
    var lang = curLang() === "ar" ? "ar-SA" : "en-US";
    var list = compatibleVoices();
    var saved = list.find(function (v) {
      return v.voiceURI === S.voiceURI;
    });
    if (saved) return saved;
    return list.sort(function (a, b) {
      return voiceScore(b, lang) - voiceScore(a, lang);
    })[0] || null;
  }
  function refreshVoices() {
    if (!("speechSynthesis" in window)) return;
    voices = window.speechSynthesis.getVoices() || [];
    var select = document.getElementById("waslVoice");
    var test = document.getElementById("waslVoiceTest");
    if (!select) return;
    var list = compatibleVoices();
    select.innerHTML = "";
    if (!list.length) {
      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = t("الصوت الافتراضي للجهاز", "Device default voice");
      select.appendChild(empty);
      select.disabled = true;
      if (test) test.disabled = true;
      return;
    }
    select.disabled = false;
    if (test) test.disabled = false;
    list.sort(function (a, b) {
      return voiceScore(b, curLang() === "ar" ? "ar-SA" : "en-US") - voiceScore(a, curLang() === "ar" ? "ar-SA" : "en-US");
    }).forEach(function (v) {
      var option = document.createElement("option");
      option.value = v.voiceURI;
      option.textContent = v.name + " (" + v.lang + ")";
      select.appendChild(option);
    });
    var best = selectedVoice();
    if (best) {
      select.value = best.voiceURI;
      if (!S.voiceURI) {
        S.voiceURI = best.voiceURI;
        save();
      }
    }
    select.setAttribute("aria-label", t("صوت القراءة", "Reading voice"));
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
  }
  function waslSpeak(text, btn) {
    try {
      if (!("speechSynthesis" in window)) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = curLang() === "ar" ? "ar-SA" : "en-US";
      var voice = selectedVoice();
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      }
      u.rate = curLang() === "ar" ? 0.9 : 0.95;
      u.pitch = 1.02;
      if (btn) {
        btn.classList.add("speaking");
        u.onend = u.onerror = function () {
          btn.classList.remove("speaking");
        };
      }
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function stopSpeak() {
    try {
      speechSynthesis.cancel();
    } catch (e) {}
    document.querySelectorAll(".wasl-speak.speaking").forEach(function (b) {
      b.classList.remove("speaking");
    });
  }
  window.waslSpeak = waslSpeak;
  function speakAuto() {
    var el = document.querySelector("[data-speak-auto]");
    if (el && S.tts) waslSpeak(el.textContent.trim());
  }

  function wireSpeakers() {
    /* explicit buttons: <button class="wasl-speak" data-speak="#sel"> */
    document.querySelectorAll("[data-speak]").forEach(function (b) {
      if (b.__wired) return;
      b.__wired = 1;
      b.setAttribute("aria-label", t("استماع", "Listen"));
      b.onclick = function () {
        var tgt = document.querySelector(b.getAttribute("data-speak"));
        if (tgt) waslSpeak(tgt.textContent.trim(), b);
      };
    });
    /* auto-read on question change */
    document.querySelectorAll("[data-speak-auto]").forEach(function (el) {
      if (el.__obs) return;
      el.__obs = 1;
      var mo = new MutationObserver(function () {
        if (S.tts) waslSpeak(el.textContent.trim());
      });
      mo.observe(el, { childList: true, characterData: true, subtree: true });
    });
    if (S.tts) setTimeout(speakAuto, 500);
  }
  window.waslWireSpeakers = wireSpeakers;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
