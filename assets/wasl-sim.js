/* ============================================================================
 * WASL — Demo Flow Simulation Layer  (wasl-sim.js)
 * ----------------------------------------------------------------------------
 * الغرض: تشغيل «سيناريو محاكاة سير النظام» كاملًا داخل المتصفح دون الحاجة إلى
 * تشغيل خادم النماذج (START-WASL). التسجيل يبقى حقيقيًا لإظهار الرحلة، أمّا
 * التحليل والنتيجة والأولوية فهي محاكاة ثابتة ومضبوطة مسبقًا لتنجح كل مرة.
 *
 * لا يمثّل هذا الملف أي تحليل فعلي للصوت. عندما يكون «وضع المحاكاة» مفعّلًا،
 * تُستبدل استدعاءات WASL_API الشبكية (health / analyze / analysis-status /
 * result / clinical-review / retake) بدوالّ محلية دائمة النجاح تعيد نتيجة
 * فرز أولي ثابتة للحالة WS-ST-001.
 *
 * عند إيقاف الوضع، تعود جميع الدوالّ إلى مسار النماذج الحقيقي كما هو.
 * ==========================================================================*/
(function (global) {
  "use strict";

  var FLAG_KEY = "waslSimMode"; // localStorage: "on" | "off"
  var CASE_ID = "WS-ST-001";

  /* -------------------- تفعيل / إيقاف الوضع -------------------- */

  function urlFlag() {
    try {
      var p = new URLSearchParams(location.search);
      if (p.get("sim") === "1") return "on";
      if (p.get("sim") === "0") return "off";
    } catch (e) {}
    return null;
  }

  function enable() {
    try { localStorage.setItem(FLAG_KEY, "on"); } catch (e) {}
  }
  function disable() {
    try { localStorage.setItem(FLAG_KEY, "off"); } catch (e) {}
  }

  function isActive() {
    var u = urlFlag();
    if (u) {
      if (u === "on") enable(); else disable();
      return u === "on";
    }
    try {
      return localStorage.getItem(FLAG_KEY) === "on";
    } catch (e) {
      return false;
    }
  }

  /* -------------------- النتيجة الثابتة (فرز أولي مُحاكى) -------------------- */

  function buildResult(assessmentId) {
    return {
      assessment_id: assessmentId || CASE_ID,
      status: "completed",
      source: "model_api", // يسمح لصفحات العرض بقراءة النتيجة من التخزين مباشرة
      simulated: true,
      demo_note_ar: "فرز أولي مولّد لأغراض عرض سير النظام — ليست نتيجة تحليل حقيقي.",
      demo_note_en: "Preliminary screening generated to demonstrate the system flow — not a real analysis.",
      model_version: "Demo Flow v1 · محاكاة عرض (بدون نموذج حقيقي)",
      analyzed_at: new Date().toISOString(),
      confidence: 0.72,
      priority: { level: "medium", label_ar: "متوسطة", label_en: "Medium" },
      recommended_service: {
        code: "SPEECH_LANGUAGE_ASSESSMENT",
        label_ar: "تقييم طلاقة شامل لدى أخصائي النطق واللغة",
        label_en: "Comprehensive fluency assessment with a speech-language pathologist",
      },
      preliminary_summary: {
        label_ar: "احتمال وجود اضطراب في طلاقة الكلام",
        label_en: "Possible speech-fluency disorder",
      },
      detected_indicators: [
        {
          label_ar: "تكرارات في الأصوات والمقاطع",
          label_en: "Sound and syllable repetitions",
          evidence_sources: ["عينة الكلام المتصل", "الاستبيان"],
        },
        {
          label_ar: "إطالات صوتية",
          label_en: "Sound prolongations",
          evidence_sources: ["عينة الكلام المتصل"],
        },
        {
          label_ar: "توقفات / انسدادات كلامية",
          label_en: "Speech blocks / pauses",
          evidence_sources: ["عينة الكلام المتصل"],
        },
      ],
      reasons: [
        {
          text_ar: "ظهرت تكرارات لأصوات ومقاطع متكررة في عينة الكلام المتصل.",
          text_en: "Repeated sounds and syllables were observed in the connected-speech sample.",
          sources: ["عينة الكلام"],
        },
        {
          text_ar: "لوحظت إطالات وتوقفات مصحوبة بعلامات جهد كلامي.",
          text_en: "Prolongations and blocks with signs of speech effort were noted.",
          sources: ["عينة الكلام"],
        },
        {
          text_ar: "تشير إفادة الأسرة إلى استمرار الأعراض قرابة سنة وتزايدها عند الاستعجال.",
          text_en: "Caregiver report indicates about one year of symptoms that increase when rushed.",
          sources: ["الاستبيان"],
        },
      ],
      stuttering_summary: {
        flagged_samples: 1,
        total_samples: 1,
        interpretation_ar:
          "تجاوزت العينة حدّ مؤشر الطلاقة في هذا العرض التوضيحي. هذه نتيجة فرز أولي وليست قياسًا لنسبة المقاطع المتلعثمة %SS ولا تشخيصًا.",
        interpretation_en:
          "The sample exceeded the fluency-indicator threshold in this demonstration. This is a preliminary screening output, not a %SS measurement or a diagnosis.",
      },
      proposed_plan: {
        items_ar: [
          "حجز تقييم طلاقة شامل لدى أخصائي النطق واللغة.",
          "قياس نسبة المقاطع المتلعثمة %SS من عينة كلام موسّعة.",
          "أخذ تاريخ تطوّري وعائلي مفصّل.",
          "توجيه الأسرة إلى استراتيجيات تخفيف ضغط الكلام حتى موعد التقييم.",
        ],
        items_en: [
          "Book a comprehensive fluency assessment with an SLP.",
          "Measure percent syllables stuttered (%SS) from an extended sample.",
          "Take a detailed developmental and family history.",
          "Coach the family on speech-pressure reduction until the assessment.",
        ],
        treatment_note_ar:
          "اختيار المسار العلاجي (مثل برنامج ليدكمب) يقرّره الأخصائي بعد التقييم الكامل.",
        treatment_note_en:
          "Treatment selection (e.g., the Lidcombe Program) is decided by the specialist after a full assessment.",
      },
      sample_results: [
        {
          task: "connected_speech",
          feature_extraction: {
            clinical_voice_features: "ok",
            warnings: [],
            trimmed_duration_seconds: 11.4,
          },
          results: {
            stuttering: { probability: 0.78, threshold: 0.5, detected: true },
            dysarthria: { probability: 0.19, threshold: 0.5, detected: false },
            voice_disorder: { probability: 0.12, threshold: 0.5, detected: false },
          },
        },
      ],
      limitations: {
        ar:
          "هذه النتيجة محاكاة ثابتة لأغراض عرض سير النظام فقط، ولا تعتمد على تحليل فعلي للصوت، ولا تتغيّر بتغيّر التسجيل. لا تُستخدم لاتخاذ قرار سريري.",
        en:
          "This result is a fixed simulation for demonstrating the system flow only. It does not reflect real audio analysis, does not change with the recording, and must not be used for clinical decisions.",
      },
      audio_quality: {
        status: "ok",
        volume_level: "acceptable",
        silence_pct: 18,
        duration_sec: 11.4,
      },
      matched_facilities: [
        {
          rank: 1,
          name_ar: "مركز النطق واللغة — مستشفى الملك فهد",
          name_en: "Speech & Language Center — King Fahd Hospital",
          distance_km: 6.2,
          next_slot_days: 5,
        },
        {
          rank: 2,
          name_ar: "عيادات التأهيل — مدينة الأمير سلطان الطبية",
          name_en: "Rehabilitation Clinics — PSMMC",
          distance_km: 9.8,
          next_slot_days: 8,
        },
      ],
      evidence: {
        speech_features: { signal_clarity_db: 27 },
        next_recommended_step_ar: "حجز تقييم طلاقة شامل لدى أخصائي النطق واللغة.",
        next_recommended_step_en:
          "Book a comprehensive fluency assessment with a speech-language pathologist.",
      },
    };
  }

  /* -------------------- كتالوج حالات المحاكاة (assets/sim-cases.js) -------------------- */
  // مصدر البيانات القابل للتعديل من غير المبرمجين. يُحمَّل ديناميكيًا عند الحاجة،
  // مع نسخة احتياطية داخلية (حالة سارة) كي تعمل التجربة حتى لو تعذّر تحميل الملف.
  var _casesPromise = null;

  function loadCases() {
    if (global.WASL_SIM_CASES) return Promise.resolve(global.WASL_SIM_CASES);
    if (_casesPromise) return _casesPromise;
    _casesPromise = new Promise(function (resolve) {
      try {
        var s = document.createElement("script");
        s.src = "assets/sim-cases.js";
        s.async = true;
        s.onload = function () {
          resolve(global.WASL_SIM_CASES || { cases: {} });
        };
        s.onerror = function () {
          // تعذّر تحميل الكتالوج (مثلاً عند الفتح عبر file:// دون خادم).
          resolve({ cases: {} });
        };
        (document.head || document.documentElement).appendChild(s);
      } catch (e) {
        resolve({ cases: {} });
      }
    });
    return _casesPromise;
  }

  function deepClone(o) {
    try {
      return JSON.parse(JSON.stringify(o));
    } catch (e) {
      return o;
    }
  }

  // يبني النتيجة النهائية لحالة معيّنة من الكتالوج (أو النسخة الاحتياطية)،
  // مع حقن الحقول الزمنية والمعرّف ومدة التسجيل الحقيقي إن توفّرت.
  function materializeResult(assessmentId, catalog, realDurationSec) {
    var id = assessmentId || CASE_ID;
    var entry = catalog && catalog.cases && catalog.cases[id];
    var result;
    if (entry && entry.result) {
      result = deepClone(entry.result);
    } else {
      // نسخة احتياطية: حالة سارة الثابتة المضمّنة داخل هذا الملف.
      result = buildResult(id);
    }
    result.assessment_id = id;
    result.status = "completed";
    result.simulated = true;
    if (!result.source) result.source = "model_api";
    result.demo_note_ar =
      result.demo_note_ar ||
      "فرز أولي مولّد لأغراض عرض سير النظام — ليست نتيجة تحليل حقيقي.";
    result.demo_note_en =
      result.demo_note_en ||
      "Preliminary screening generated to demonstrate the system flow — not a real analysis.";
    result.analyzed_at = new Date().toISOString();

    // استخدم مدة التسجيل الحقيقي (إن وُجدت) لتبدو الرحلة متماسكة.
    if (typeof realDurationSec === "number" && realDurationSec > 0) {
      var d = Math.round(realDurationSec * 10) / 10;
      if (result.audio_quality) result.audio_quality.duration_sec = d;
      if (
        result.sample_results &&
        result.sample_results[0] &&
        result.sample_results[0].feature_extraction
      ) {
        result.sample_results[0].feature_extraction.trimmed_duration_seconds = d;
      }
    }
    return result;
  }

  // قراءة مدة التسجيل الحقيقي للعينة (إن وُجد) من مخزن التسجيلات.
  function readRealDuration(store, id) {
    if (!store || !store.listRecordingsMeta) return Promise.resolve(null);
    return store
      .listRecordingsMeta(id)
      .then(function (list) {
        if (!list || !list.length) return null;
        var rec =
          list.filter(function (r) {
            return r && r.task === "connected_speech";
          })[0] || list[0];
        var d = rec && (rec.duration_sec || rec.duration || (rec.meta && rec.meta.duration_sec));
        return typeof d === "number" && d > 0 ? d : null;
      })
      .catch(function () {
        return null;
      });
  }

  /* -------------------- محاكاة مراحل التحليل المتحركة -------------------- */
  // خطة تقدّم المراحل عبر عمليات الاستطلاع المتتابعة من ai-processing.html
  var _ticks = {};
  var STAGE_PLAN = [
    { status: "queued", stage_index: 0, progress: 0.05 },
    { status: "processing", stage_index: 0, progress: 0.22 },
    { status: "processing", stage_index: 1, progress: 0.46 },
    { status: "processing", stage_index: 2, progress: 0.7 },
    { status: "processing", stage_index: 3, progress: 0.9 },
    { status: "completed", stage_index: 4, progress: 1 },
  ];

  function newJobId() {
    return "sim-" + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  }

  /* -------------------- بدائل WASL_API عند تفعيل المحاكاة -------------------- */

  function simHealth() {
    return Promise.resolve({ status: "ok", mode: "simulation", models: "ready" });
  }

  function simAnalyze(assessmentId) {
    var id = assessmentId || CASE_ID;
    _ticks[id] = 0;
    var jobId = newJobId();
    var store = global.WASL_STORE;
    var chain = store
      ? store.getAssessment(id).then(function (a) {
          a = a || { assessment_id: id, created_at: Date.now() };
          a.job = { job_id: jobId, status: "accepted", source: "simulation" };
          a.status = "processing";
          a.simulated = true;
          return store.putAssessment(a).then(function () {
            return store.appendAudit(id, {
              event: "analysis_started",
              actor: "system",
              details: { job_id: jobId, source: "simulation", mode: "demo_flow" },
            });
          });
        })
      : Promise.resolve();
    return chain.then(function () {
      return { job_id: jobId, status: "accepted", source: "simulation" };
    });
  }

  function simAnalysisStatus(assessmentId) {
    var id = assessmentId || CASE_ID;
    var t = _ticks[id] || 0;
    if (t >= STAGE_PLAN.length) t = STAGE_PLAN.length - 1;
    var step = STAGE_PLAN[t];
    _ticks[id] = t + 1;
    return Promise.resolve({
      status: step.status,
      stage_index: step.stage_index,
      progress: step.progress,
      source: "simulation",
    });
  }

  function simGetResult(assessmentId) {
    var id = assessmentId || CASE_ID;
    var store = global.WASL_STORE;
    if (!store) {
      return loadCases().then(function (cat) {
        return materializeResult(id, cat, null);
      });
    }
    return store.getAssessment(id).then(function (a) {
      a = a || { assessment_id: id, created_at: Date.now() };
      // ثبات النتيجة: إذا سبق توليد نتيجة محاكاة لهذا التقييم، أعِدها كما هي.
      if (a.result && a.result.simulated && a.result.assessment_id === id) {
        return a.result;
      }
      return Promise.all([loadCases(), readRealDuration(store, id)]).then(function (r) {
        var result = materializeResult(id, r[0], r[1]);
        result.assessment_id = a.assessment_id || id;
        a.result = result;
        a.status = "completed";
        a.simulated = true;
        return store.putAssessment(a).then(function () {
          return store
            .appendAudit(id, {
              event: "analysis_completed",
              actor: "system",
              details: { source: "simulation", model_version: result.model_version },
            })
            .then(function () {
              return result;
            });
        });
      });
    });
  }

  function simSubmitClinicalReview(assessmentId, decision) {
    var id = assessmentId || CASE_ID;
    var store = global.WASL_STORE;
    decision = decision || {};
    var review = {
      priority: decision.priority || "medium",
      service: decision.service || "SPEECH_LANGUAGE_ASSESSMENT",
      notes: decision.notes || "",
      care_plan: decision.care_plan || "",
      in_person: !!decision.in_person,
      reviewer_ar: "أ. ريم محمد — أخصائية نطق ولغة",
      reviewer_en: "Reem Mohammed — Speech-language pathologist",
      reviewed_at: new Date().toISOString(),
      source: "simulation",
    };
    var chain = store
      ? store
          .patchAssessment(id, { clinical_review: review, status: "clinically_reviewed" })
          .then(function () {
            return store.appendAudit(id, {
              event: "clinical_review_submitted",
              actor: "specialist",
              details: { priority: review.priority, service: review.service, source: "simulation" },
            });
          })
      : Promise.resolve();
    return chain.then(function () {
      return { ok: true, review: review };
    });
  }

  function simRequestRetake(assessmentId, task, reason) {
    var id = assessmentId || CASE_ID;
    var store = global.WASL_STORE;
    var chain = store
      ? store.getAssessment(id).then(function (a) {
          a = a || { assessment_id: id };
          a.retake_requests = a.retake_requests || [];
          a.retake_requests.push({
            task: task,
            reason: reason || "",
            requested_at: new Date().toISOString(),
          });
          return store.putAssessment(a);
        })
      : Promise.resolve();
    return chain.then(function () {
      return { ok: true, task: task };
    });
  }

  /* -------------------- تركيب البدائل فوق WASL_API -------------------- */

  function install() {
    var API = global.WASL_API;
    if (!API || API.__simInstalled) return;
    API.__simInstalled = true;

    var real = {
      health: API.health,
      analyze: API.analyze,
      analysisStatus: API.analysisStatus,
      getResult: API.getResult,
      submitClinicalReview: API.submitClinicalReview,
      requestRetake: API.requestRetake,
    };

    function wrap(sim, realFn) {
      return function () {
        var args = Array.prototype.slice.call(arguments);
        if (isActive()) {
          return sim.apply(null, args);
        }
        return realFn ? realFn.apply(API, args) : Promise.reject(new Error("unavailable"));
      };
    }

    API.health = wrap(simHealth, real.health);
    API.analyze = wrap(simAnalyze, real.analyze);
    API.analysisStatus = wrap(simAnalysisStatus, real.analysisStatus);
    API.getResult = wrap(simGetResult, real.getResult);
    API.submitClinicalReview = wrap(simSubmitClinicalReview, real.submitClinicalReview);
    API.requestRetake = wrap(simRequestRetake, real.requestRetake);
  }

  /* -------------------- شارة الوضع العائمة -------------------- */

  function injectBadge() {
    if (!isActive()) return;
    if (document.getElementById("waslSimBadge")) return;
    var mount = function () {
      if (document.getElementById("waslSimBadge")) return;
      var ar = document.documentElement.lang !== "en";
      var bar = document.createElement("div");
      bar.id = "waslSimBadge";
      bar.setAttribute("role", "note");
      bar.style.cssText =
        "position:fixed;z-index:2147483000;inset-inline-end:16px;bottom:16px;" +
        "display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:999px;" +
        "background:#0f2350;color:#dfe7ff;font:700 12px/1 Tajawal,system-ui,sans-serif;" +
        "box-shadow:0 10px 30px rgba(15,35,80,.35);border:1px solid #26407e;max-width:92vw;";
      var dot =
        '<span style="width:8px;height:8px;border-radius:50%;background:#25e0b0;flex:none;box-shadow:0 0 0 4px rgba(37,224,176,.18)"></span>';
      var label =
        '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
        (ar
          ? "وضع محاكاة العرض · نتيجة ثابتة بدون تحليل حقيقي"
          : "Demo simulation · fixed result, no real analysis") +
        "</span>";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = ar ? "إيقاف" : "Turn off";
      btn.style.cssText =
        "flex:none;border:0;border-radius:999px;padding:5px 11px;cursor:pointer;" +
        "background:#25406f;color:#eaf1ff;font:700 11px Tajawal,system-ui,sans-serif;";
      btn.onclick = function () {
        disable();
        location.reload();
      };
      bar.innerHTML = dot + label;
      bar.appendChild(btn);
      document.body.appendChild(bar);
    };
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount);
  }

  /* -------------------- الإقلاع -------------------- */

  install();
  injectBadge();

  global.WASL_SIM = {
    CASE_ID: CASE_ID,
    enable: enable,
    disable: disable,
    isActive: isActive,
    buildResult: buildResult,
    install: install,
    injectBadge: injectBadge,
    loadCases: loadCases,
    getCase: function (id) {
      return loadCases().then(function (cat) {
        return (cat.cases && cat.cases[id]) || null;
      });
    },
  };
})(window);
