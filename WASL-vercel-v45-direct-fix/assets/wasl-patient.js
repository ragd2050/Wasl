/* ============================================================================
 * WASL — Single Patient Data Source
 * ----------------------------------------------------------------------------
 * One source of truth for the demo patient. Do NOT hardcode the name, age, or
 * ID in individual pages — read them from here so every screen stays in sync.
 *
 * Privacy: the national ID is NEVER stored or shown in full. Only a fully
 * masked value is exposed, and it never begins with a real digit.
 * ==========================================================================*/
(function (global) {
  "use strict";

  var PATIENT = {
    name_ar: "سارة عبدالله العتيبي",
    name_en: "Sara Abdullah Al-Otaibi",
    age: 6,
    // Fully masked — no real digits, does not start with 1.
    national_id_masked: "XXXXXXXXXX",
    national_id_masked_x: "XXXXXXXXXX",
  };

  // Use the appointment chosen on the reception dashboard. The default
  // profile above remains available when a page is opened directly.
  try {
    var selected = JSON.parse(localStorage.getItem("waslSelectedPatient") || "null");
    if (selected && selected.name_ar && selected.name_en) {
      PATIENT = Object.assign(PATIENT, selected);
    }
  } catch (e) {}

  function get() {
    // Return a copy so callers cannot mutate the source.
    return Object.assign({}, PATIENT);
  }

  function name(lang) {
    return lang === "en" ? PATIENT.name_en : PATIENT.name_ar;
  }

  function maskedId() {
    return PATIENT.national_id_masked;
  }

  function ageText(lang) {
    if (lang === "en") {
      return PATIENT.age + " years";
    }
    return PATIENT.age + " سنوات";
  }

  global.WASL_PATIENT = {
    get: get,
    name: name,
    maskedId: maskedId,
    ageText: ageText,
  };
})(window);
