/* WASL safety routing rules.
 * These rules identify answers that require prompt human review. They do not
 * diagnose a condition and never replace emergency or specialist assessment.
 */
(function (global) {
  "use strict";

  var RULES = [
    {
      key: "sudden_hearing",
      values: ["yes"],
      code: "SUDDEN_HEARING_CHANGE",
      level: "urgent",
      ar: "تغيّر مفاجئ في السمع",
      en: "Sudden change in hearing",
    },
    {
      key: "regression",
      values: ["yes"],
      code: "SKILL_REGRESSION",
      level: "urgent",
      ar: "فقدان مفاجئ لكلمات أو مهارات سبق اكتسابها",
      en: "Sudden loss of previously acquired words or skills",
    },
    {
      key: "face_weakness",
      values: ["yes"],
      code: "FACIAL_WEAKNESS",
      level: "urgent",
      ar: "ضعف أو عدم تماثل في حركة الوجه",
      en: "Facial weakness or asymmetry",
    },
    {
      key: "choking",
      values: ["often", "sometimes"],
      code: "CHOKING_HISTORY",
      level: "urgent",
      ar: "تكرار الاختناق أثناء الأكل أو الشرب",
      en: "Repeated choking while eating or drinking",
    },
    {
      key: "pneumonia",
      values: ["yes"],
      code: "RECURRENT_CHEST_INFECTION",
      level: "urgent",
      ar: "التهاب رئوي أو صدري متكرر مع صعوبة البلع",
      en: "Repeated chest infection alongside swallowing difficulty",
    },
    {
      key: "breathing",
      values: ["support"],
      code: "BREATHING_CONCERN",
      level: "priority_review",
      ar: "ملاحظة تتعلق بالتنفس أو التحكم بالنفس أثناء الكلام",
      en: "Concern about breathing or breath control during speech",
    },
    {
      key: "swallow",
      values: ["yes"],
      code: "SWALLOWING_CONCERN",
      level: "priority_review",
      ar: "صعوبة في البلع",
      en: "Difficulty swallowing",
    },
  ];

  function evaluate(answers) {
    answers = answers || {};
    var matches = RULES.filter(function (rule) {
      return rule.values.indexOf(answers[rule.key]) !== -1;
    });
    var level = matches.some(function (item) {
      return item.level === "urgent";
    })
      ? "urgent"
      : matches.length
        ? "priority_review"
        : "none";

    return {
      level: level,
      requires_staff_review: matches.length > 0,
      matched_rules: matches.map(function (item) {
        return {
          code: item.code,
          level: item.level,
          label_ar: item.ar,
          label_en: item.en,
          answer_key: item.key,
        };
      }),
      evaluated_at: new Date().toISOString(),
    };
  }

  global.WASL_RED_FLAGS = {
    RULES: RULES,
    evaluate: evaluate,
  };
})(window);
