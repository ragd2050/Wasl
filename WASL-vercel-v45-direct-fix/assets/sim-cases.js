/* ============================================================================
 * WASL — بيانات حالات المحاكاة (sim-cases.js)
 * ----------------------------------------------------------------------------
 * هذا ملف بيانات فقط (كائن JSON). يمكن لغير المبرمجين تعديل القيم بسهولة:
 * الأولوية، المؤشرات، الأسباب، الخطوة التالية، ونصوص ولي الأمر… إلخ.
 * لا تحتاج إلى تعديل أي شيفرة أخرى. غيّري القيم بين علامات الاقتباس فقط،
 * وحافظي على الفواصل والأقواس كما هي.
 *
 * كل حالة تتكوّن من:
 *   profile         : بيانات الطفل التعريفية (اسم، عمر، سبب الإحالة…).
 *   intake_defaults : الإجابات المعبّأة مسبقًا في الاستبيان وفحص السمع.
 *   result          : نتيجة الفرز الأولي الثابتة (محاكاة — ليست تحليلًا حقيقيًا).
 *
 * الأولوية (priority.level) تقبل: "low" أو "medium" أو "high".
 * المسار (recommended_service.code) يُفضّل أن يكون أحد:
 *   SPEECH_FLUENCY_ASSESSMENT · SPEECH_LANGUAGE_ASSESSMENT ·
 *   AUDIOLOGY_ASSESSMENT · ROUTINE_MONITORING
 * ==========================================================================*/
window.WASL_SIM_CASES = {
  version: "2",
  note_ar: "بيانات حالات محاكاة لأغراض عرض سير النظام فقط — ليست تشخيصًا.",

  cases: {
    /* ===================== حالة (١): سارة — أولوية متوسطة ===================== */
    "WS-ST-001": {
      profile: {
        first_ar: "سارة",
        first_en: "Sara",
        patient_name_ar: "سارة عبدالله العتيبي",
        patient_name_en: "Sara Abdullah Al-Otaibi",
        age_ar: "5 سنوات و3 أشهر",
        age_en: "5 years 3 months",
        type_ar: "اشتباه باضطراب طلاقة الكلام",
        type_en: "Suspected speech-fluency disorder",
        referral_ar: "تكرار أصوات ومقاطع وإطالات وتوقفات أثناء الكلام.",
        referral_en: "Sound and syllable repetitions, prolongations and speech blocks.",
        duration_ar: "قرابة سنة",
        duration_en: "Approximately one year",
        features_ar: "تزداد عند الاستعجال مع توتر جسدي عارض وضرب القدم.",
        features_en: "Reported to increase when rushed, with occasional tension and foot stomping.",
        source_ar: "بيانات الإحالة والاستبيان الأولي.",
        source_en: "Referral and preliminary questionnaire data.",
      },
      intake_defaults: {
        main_concern: "fluency",
        symptom_duration: "12_months",
        features: "all",
        secondary_behaviors: "sometimes",
        family_history: "unknown",
        hearing: {
          responds_to_name: "yes",
          hearing_difficulty: "no",
          ear_infections: "no",
          prior_screen: "pass",
        },
      },
      result: {
        source: "model_api",
        confidence: 0.72,
        model_version: "Demo Flow v2 · محاكاة عرض (بدون نموذج حقيقي)",
        priority: { level: "medium", label_ar: "متوسطة", label_en: "Medium" },
        recommended_service: {
          code: "SPEECH_FLUENCY_ASSESSMENT",
          label_ar: "تقييم طلاقة شامل لدى أخصائي النطق واللغة",
          label_en: "Comprehensive fluency assessment with a speech-language pathologist",
        },
        preliminary_summary: {
          label_ar: "احتمال وجود اضطراب في طلاقة الكلام",
          label_en: "Possible speech-fluency disorder",
        },
        detected_indicators: [
          { label_ar: "تكرارات في الأصوات والمقاطع", label_en: "Sound and syllable repetitions", evidence_sources: ["عينة الكلام المتصل", "الاستبيان"] },
          { label_ar: "إطالات صوتية", label_en: "Sound prolongations", evidence_sources: ["عينة الكلام المتصل"] },
          { label_ar: "توقفات / انسدادات كلامية", label_en: "Speech blocks / pauses", evidence_sources: ["عينة الكلام المتصل"] },
        ],
        reasons: [
          { text_ar: "ظهرت تكرارات لأصوات ومقاطع متكررة في عينة الكلام المتصل.", text_en: "Repeated sounds and syllables were observed in the connected-speech sample.", sources: ["عينة الكلام"] },
          { text_ar: "لوحظت إطالات وتوقفات مصحوبة بعلامات جهد كلامي.", text_en: "Prolongations and blocks with signs of speech effort were noted.", sources: ["عينة الكلام"] },
          { text_ar: "تشير إفادة الأسرة إلى استمرار الأعراض قرابة سنة وتزايدها عند الاستعجال.", text_en: "Caregiver report indicates about one year of symptoms that increase when rushed.", sources: ["الاستبيان"] },
        ],
        stuttering_summary: {
          flagged_samples: 1,
          total_samples: 1,
          interpretation_ar: "تجاوزت العينة حدّ مؤشر الطلاقة في هذا العرض التوضيحي. هذه نتيجة فرز أولي وليست قياسًا لنسبة المقاطع المتلعثمة %SS ولا تشخيصًا.",
          interpretation_en: "The sample exceeded the fluency-indicator threshold in this demonstration. This is a preliminary screening output, not a %SS measurement or a diagnosis.",
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
          treatment_note_ar: "اختيار المسار العلاجي (مثل برنامج ليدكمب) يقرّره الأخصائي بعد التقييم الكامل.",
          treatment_note_en: "Treatment selection (e.g., the Lidcombe Program) is decided by the specialist after a full assessment.",
        },
        sample_results: [
          {
            task: "connected_speech",
            feature_extraction: { clinical_voice_features: "ok", warnings: [], trimmed_duration_seconds: 11.4 },
            results: {
              stuttering: { probability: 0.78, threshold: 0.5, detected: true },
              dysarthria: { probability: 0.19, threshold: 0.5, detected: false },
              voice_disorder: { probability: 0.12, threshold: 0.5, detected: false },
            },
          },
        ],
        limitations: {
          ar: "هذه النتيجة محاكاة ثابتة لأغراض عرض سير النظام فقط، ولا تعتمد على تحليل فعلي للصوت، ولا تتغيّر بتغيّر التسجيل. لا تُستخدم لاتخاذ قرار سريري.",
          en: "This result is a fixed simulation for demonstrating the system flow only. It does not reflect real audio analysis, does not change with the recording, and must not be used for clinical decisions.",
        },
        audio_quality: { status: "ok", volume_level: "acceptable", silence_pct: 18, duration_sec: 11.4 },
        matched_facilities: [
          { rank: 1, name_ar: "مركز النطق واللغة — مستشفى الملك فهد", name_en: "Speech & Language Center — King Fahd Hospital", distance_km: 6.2, next_slot_days: 5 },
          { rank: 2, name_ar: "عيادات التأهيل — مدينة الأمير سلطان الطبية", name_en: "Rehabilitation Clinics — PSMMC", distance_km: 9.8, next_slot_days: 8 },
        ],
        evidence: {
          speech_features: { signal_clarity_db: 27 },
          next_recommended_step_ar: "حجز تقييم طلاقة شامل لدى أخصائي النطق واللغة.",
          next_recommended_step_en: "Book a comprehensive fluency assessment with a speech-language pathologist.",
        },
        guardian_message_ar: "تشير نتائج التقييم الأولي إلى وجود مؤشرات على صعوبة في طلاقة الكلام تستدعي مراجعة أخصائي. يحدد الأخصائي الخطوة التالية المناسبة، ولا يمثّل ذلك تشخيصًا نهائيًا.",
        guardian_message_en: "The preliminary screening suggests fluency indicators that warrant a specialist review. The specialist approved the next step; this is not a final diagnosis.",
      },
    },

    /* ============= حالة (٢): فيصل — ضمن الحدود الطبيعية · أولوية منخفضة ============= */
    "WS-ST-010": {
      profile: {
        first_ar: "فيصل",
        first_en: "Faisal",
        patient_name_ar: "فيصل ناصر القحطاني",
        patient_name_en: "Faisal Nasser Al-Qahtani",
        age_ar: "4 سنوات وشهران",
        age_en: "4 years 2 months",
        type_ar: "تقييم طلاقة — طمأنة الأسرة",
        type_en: "Fluency screen — family reassurance",
        referral_ar: "ملاحظة الأسرة تكرار بعض الكلمات الكاملة أحيانًا عند الحماس.",
        referral_en: "Family noticed occasional whole-word repetitions when excited.",
        duration_ar: "أقل من ثلاثة أشهر",
        duration_en: "Under three months",
        features_ar: "تكرار كلمات كاملة عرضي دون توتر أو توقفات.",
        features_en: "Occasional whole-word repetition, no tension or blocks.",
        source_ar: "بيانات الإحالة والاستبيان الأولي.",
        source_en: "Referral and preliminary questionnaire data.",
      },
      intake_defaults: {
        main_concern: "fluency",
        symptom_duration: "lt_3m",
        features: "repetitions",
        secondary_behaviors: "no",
        family_history: "no",
        hearing: {
          responds_to_name: "yes",
          hearing_difficulty: "no",
          ear_infections: "no",
          prior_screen: "pass",
        },
      },
      result: {
        source: "model_api",
        confidence: 0.69,
        model_version: "Demo Flow v2 · محاكاة عرض (بدون نموذج حقيقي)",
        priority: { level: "low", label_ar: "منخفضة", label_en: "Low" },
        recommended_service: {
          code: "ROUTINE_MONITORING",
          label_ar: "متابعة روتينية وإعادة فرز عند اللزوم",
          label_en: "Routine monitoring, re-screen if needed",
        },
        preliminary_summary: {
          label_ar: "ضمن الحدود الطبيعية — عدم طلاقة تطوّرية نمطية",
          label_en: "Within normal limits — typical developmental disfluency",
        },
        detected_indicators: [
          { label_ar: "تكرار كلمات كاملة عرضي ضمن النطاق التطوّري", label_en: "Occasional whole-word repetition within the developmental range", evidence_sources: ["عينة الكلام المتصل", "الاستبيان"] },
        ],
        reasons: [
          { text_ar: "لم تتجاوز مؤشرات الطلاقة الحدّ في عينة الكلام؛ التكرارات محدودة وطبيعية للعمر.", text_en: "Fluency indicators stayed below threshold; repetitions were limited and age-typical.", sources: ["عينة الكلام"] },
          { text_ar: "لا توجد توقفات أو إطالات أو علامات جهد كلامي أو سلوكيات مصاحبة.", text_en: "No blocks, prolongations, speech effort or secondary behaviors were present.", sources: ["عينة الكلام", "الاستبيان"] },
          { text_ar: "مدة الملاحظة قصيرة (أقل من ثلاثة أشهر) دون تاريخ عائلي.", text_en: "Short observation window (under three months) with no family history.", sources: ["الاستبيان"] },
        ],
        stuttering_summary: {
          flagged_samples: 0,
          total_samples: 1,
          interpretation_ar: "لم تتجاوز العينة حدّ مؤشر الطلاقة في هذا العرض التوضيحي. النتيجة ضمن الحدود الطبيعية، وهي فرز أولي وليست تشخيصًا.",
          interpretation_en: "The sample did not exceed the fluency-indicator threshold in this demonstration. The result is within normal limits — a preliminary screening, not a diagnosis.",
        },
        proposed_plan: {
          items_ar: [
            "طمأنة الأسرة بأن عدم الطلاقة العابر شائع في هذا العمر.",
            "متابعة منزلية بسيطة وملاحظة أي تغيّر خلال الأشهر القادمة.",
            "تزويد الأسرة بإرشادات دعم الطلاقة اليومية.",
            "إعادة الفرز بعد ٣ أشهر عند استمرار الملاحظات أو تزايدها.",
          ],
          items_en: [
            "Reassure the family that transient disfluency is common at this age.",
            "Simple home monitoring; note any change over the coming months.",
            "Share everyday fluency-support tips with the family.",
            "Re-screen in ~3 months if concerns persist or increase.",
          ],
          treatment_note_ar: "لا يُوصى بإجراء عاجل حاليًا؛ المتابعة كافية ما لم تظهر مؤشرات جديدة.",
          treatment_note_en: "No urgent action is recommended now; monitoring suffices unless new indicators appear.",
        },
        sample_results: [
          {
            task: "connected_speech",
            feature_extraction: { clinical_voice_features: "ok", warnings: [], trimmed_duration_seconds: 10.2 },
            results: {
              stuttering: { probability: 0.22, threshold: 0.5, detected: false },
              dysarthria: { probability: 0.12, threshold: 0.5, detected: false },
              voice_disorder: { probability: 0.09, threshold: 0.5, detected: false },
            },
          },
        ],
        limitations: {
          ar: "هذه النتيجة محاكاة ثابتة لأغراض عرض سير النظام فقط، ولا تعتمد على تحليل فعلي للصوت، ولا تتغيّر بتغيّر التسجيل. لا تُستخدم لاتخاذ قرار سريري.",
          en: "This result is a fixed simulation for demonstrating the system flow only. It does not reflect real audio analysis, does not change with the recording, and must not be used for clinical decisions.",
        },
        audio_quality: { status: "ok", volume_level: "acceptable", silence_pct: 21, duration_sec: 10.2 },
        matched_facilities: [
          { rank: 1, name_ar: "مركز الرعاية الأولية — الحي", name_en: "Primary Care Center — Neighborhood", distance_km: 2.1, next_slot_days: 14 },
        ],
        evidence: {
          speech_features: { signal_clarity_db: 26 },
          next_recommended_step_ar: "متابعة منزلية وإعادة الفرز بعد ٣ أشهر عند استمرار الملاحظات.",
          next_recommended_step_en: "Home monitoring; re-screen in about 3 months if concerns persist.",
        },
        guardian_message_ar: "جاءت نتائج الفرز الأولي ضمن الحدود الطبيعية لعمر فيصل، ولا حاجة لإجراء عاجل. يُنصح بمتابعة بسيطة في المنزل وإعادة الفرز لاحقًا إذا لاحظتم أي تغيّر.",
        guardian_message_en: "Faisal's preliminary screening is within the normal range for his age, with no urgent action needed. Simple home monitoring is recommended, with a later re-screen if you notice any change.",
      },
    },

    /* ================= حالة (٣): لمى — مؤشرات واضحة · أولوية عالية ================= */
    "WS-ST-020": {
      profile: {
        first_ar: "لمى",
        first_en: "Lama",
        patient_name_ar: "لمى خالد الشهري",
        patient_name_en: "Lama Khalid Al-Shehri",
        age_ar: "6 سنوات وشهر",
        age_en: "6 years 1 month",
        type_ar: "اشتباه باضطراب طلاقة واضح",
        type_en: "Suspected marked fluency disorder",
        referral_ar: "انسدادات متكررة مع توتر وجهي وتجنّب للكلام في المدرسة.",
        referral_en: "Frequent blocks with facial tension and speech avoidance at school.",
        duration_ar: "أكثر من سنة ونصف",
        duration_en: "More than 18 months",
        features_ar: "توقفات وانسدادات متكررة، توتر ظاهر، وتجنّب كلمات ومواقف.",
        features_en: "Frequent blocks, visible tension, and avoidance of words and situations.",
        source_ar: "بيانات الإحالة والاستبيان الأولي.",
        source_en: "Referral and preliminary questionnaire data.",
      },
      intake_defaults: {
        main_concern: "fluency",
        symptom_duration: "12_months",
        features: "all",
        secondary_behaviors: "yes",
        family_history: "yes",
        hearing: {
          responds_to_name: "yes",
          hearing_difficulty: "no",
          ear_infections: "no",
          prior_screen: "pass",
        },
      },
      result: {
        source: "model_api",
        confidence: 0.91,
        model_version: "Demo Flow v2 · محاكاة عرض (بدون نموذج حقيقي)",
        priority: { level: "high", label_ar: "عالية", label_en: "High" },
        recommended_service: {
          code: "SPEECH_FLUENCY_ASSESSMENT",
          label_ar: "تقييم طلاقة شامل عاجل لدى أخصائي النطق واللغة",
          label_en: "Expedited comprehensive fluency assessment with an SLP",
        },
        preliminary_summary: {
          label_ar: "مؤشرات واضحة على اضطراب طلاقة يستدعي أولوية عاجلة",
          label_en: "Clear fluency-disorder indicators warranting urgent priority",
        },
        detected_indicators: [
          { label_ar: "توقفات وانسدادات كلامية متكررة", label_en: "Frequent speech blocks", evidence_sources: ["عينة الكلام المتصل"] },
          { label_ar: "توتر وجهي وسلوكيات مصاحبة", label_en: "Facial tension and secondary behaviors", evidence_sources: ["عينة الكلام المتصل", "الاستبيان"] },
          { label_ar: "تجنّب كلمات ومواقف الكلام", label_en: "Word and situation avoidance", evidence_sources: ["الاستبيان"] },
          { label_ar: "تكرارات وإطالات متكررة", label_en: "Frequent repetitions and prolongations", evidence_sources: ["عينة الكلام المتصل"] },
        ],
        reasons: [
          { text_ar: "تكرّرت الانسدادات الكلامية بوضوح في عينة الكلام مع علامات جهد ظاهرة.", text_en: "Speech blocks recurred clearly in the sample with visible effort.", sources: ["عينة الكلام"] },
          { text_ar: "ظهر توتر وجهي وسلوكيات مصاحبة تدل على شدّة أعلى.", text_en: "Facial tension and secondary behaviors indicated greater severity.", sources: ["عينة الكلام", "الاستبيان"] },
          { text_ar: "أفادت الأسرة باستمرار الأعراض أكثر من سنة ونصف مع تجنّب للكلام وتاريخ عائلي.", text_en: "Family reported symptoms for over 18 months with avoidance and a positive family history.", sources: ["الاستبيان"] },
        ],
        stuttering_summary: {
          flagged_samples: 1,
          total_samples: 1,
          interpretation_ar: "تجاوزت العينة حدّ مؤشر الطلاقة بوضوح في هذا العرض التوضيحي. هذه نتيجة فرز أولي تشير إلى شدّة أعلى، وليست قياسًا لـ %SS ولا تشخيصًا.",
          interpretation_en: "The sample clearly exceeded the fluency-indicator threshold in this demonstration, suggesting higher severity. It is a preliminary screening, not a %SS measurement or a diagnosis.",
        },
        proposed_plan: {
          items_ar: [
            "جدولة تقييم طلاقة شامل عاجل لدى أخصائي النطق واللغة.",
            "قياس نسبة المقاطع المتلعثمة %SS وشدّة التلعثم من عينة موسّعة.",
            "إرشاد الأسرة وتقليل ضغط الكلام والتواصل مع المدرسة.",
            "بحث خيارات التدخل المبكر بعد التقييم الكامل.",
          ],
          items_en: [
            "Schedule an expedited comprehensive fluency assessment with an SLP.",
            "Measure %SS and stuttering severity from an extended sample.",
            "Counsel the family, reduce speech pressure, and coordinate with the school.",
            "Explore early-intervention options after the full assessment.",
          ],
          treatment_note_ar: "اختيار المسار العلاجي يقرّره الأخصائي بعد التقييم الكامل؛ يُوصى بعدم التأخير.",
          treatment_note_en: "Treatment selection is decided by the specialist after a full assessment; avoiding delay is advised.",
        },
        sample_results: [
          {
            task: "connected_speech",
            feature_extraction: { clinical_voice_features: "ok", warnings: [], trimmed_duration_seconds: 12.7 },
            results: {
              stuttering: { probability: 0.93, threshold: 0.5, detected: true },
              dysarthria: { probability: 0.21, threshold: 0.5, detected: false },
              voice_disorder: { probability: 0.16, threshold: 0.5, detected: false },
            },
          },
        ],
        limitations: {
          ar: "هذه النتيجة محاكاة ثابتة لأغراض عرض سير النظام فقط، ولا تعتمد على تحليل فعلي للصوت، ولا تتغيّر بتغيّر التسجيل. لا تُستخدم لاتخاذ قرار سريري.",
          en: "This result is a fixed simulation for demonstrating the system flow only. It does not reflect real audio analysis, does not change with the recording, and must not be used for clinical decisions.",
        },
        audio_quality: { status: "ok", volume_level: "acceptable", silence_pct: 15, duration_sec: 12.7 },
        matched_facilities: [
          { rank: 1, name_ar: "مركز النطق واللغة — مستشفى الملك فهد", name_en: "Speech & Language Center — King Fahd Hospital", distance_km: 6.2, next_slot_days: 3 },
          { rank: 2, name_ar: "عيادات التأهيل — مدينة الأمير سلطان الطبية", name_en: "Rehabilitation Clinics — PSMMC", distance_km: 9.8, next_slot_days: 6 },
        ],
        evidence: {
          speech_features: { signal_clarity_db: 28 },
          next_recommended_step_ar: "جدولة تقييم طلاقة شامل عاجل لدى أخصائي النطق واللغة.",
          next_recommended_step_en: "Schedule an expedited comprehensive fluency assessment with a speech-language pathologist.",
        },
        guardian_message_ar: "تشير نتائج التقييم الأولي إلى مؤشرات واضحة على صعوبة في طلاقة الكلام تستدعي مراجعة أخصائي بأولوية عاجلة. يحدد الأخصائي الخطوة التالية، ولا يمثّل ذلك تشخيصًا نهائيًا.",
        guardian_message_en: "The preliminary screening shows clear fluency indicators that warrant an urgent specialist review. The specialist approved the next step; this is not a final diagnosis.",
      },
    },
  },
};
