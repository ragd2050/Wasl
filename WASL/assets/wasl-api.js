/* WASL browser client for the real, server-side model connection. */
(function (global) {
  "use strict";

  var LOCAL_HOSTS = ["127.0.0.1", "localhost"];
  var isLocalHost =
    location.protocol === "file:" ||
    LOCAL_HOSTS.indexOf(location.hostname) !== -1;
  var API_BASE =
    global.WASL_API_BASE ||
    (isLocalHost && location.port !== "8080"
      ? "http://127.0.0.1:8080"
      : "");
  var STAGES = [
    {
      label_ar: "التحقق من التسجيلات",
      label_en: "Checking recordings",
      component: "Audio validation",
    },
    {
      label_ar: "تجهيز الصوت للتحليل",
      label_en: "Preparing audio",
      component: "PCM conversion",
    },
    {
      label_ar: "تحليل التسجيلات",
      label_en: "Analyzing recordings",
      component: "WASL screening API",
    },
    {
      label_ar: "تجهيز نتائج المختص",
      label_en: "Preparing specialist results",
      component: "Evidence mapping",
    },
  ];
  var ANALYZABLE_TASKS = [
    "picture_naming",
    "picture_description",
    "story_narration",
    "reading",
    "connected_speech",
  ];

  function newAssessmentId() {
    var year = new Date().getFullYear();
    var suffix = String(1000 + Math.floor(Math.random() * 9000)).slice(1);
    return "WSL-" + year + "-" + suffix;
  }

  function apiError(response, payload) {
    var detail = payload && payload.detail ? payload.detail : payload || {};
    var error = new Error(detail.error_en || "WASL API request failed");
    error.status = response.status;
    error.code = detail.code || "API_REQUEST_FAILED";
    error.error_ar = detail.error_ar || "تعذّر إكمال الطلب. يرجى المحاولة مرة أخرى.";
    error.error_en = detail.error_en || "The request could not be completed. Please try again.";
    error.payload = payload;
    return error;
  }

  async function request(path, options) {
    var response;
    try {
      response = await fetch(API_BASE + path, options || {});
    } catch (cause) {
      var offline = new Error("WASL connection service is unavailable");
      offline.code = "CONNECTION_UNAVAILABLE";
      offline.error_ar = isLocalHost
        ? "محرك الذكاء الاصطناعي غير مشغّل. أغلق Live Server، ثم شغّل START-WASL.bat وافتح الموقع من العنوان 127.0.0.1:8080. تسجيلاتك ما زالت محفوظة."
        : "خدمة تحليل الصوت غير متاحة الآن. تسجيلاتك ما زالت محفوظة ويمكن إعادة المحاولة.";
      offline.error_en = isLocalHost
        ? "The AI engine is not running. Close Live Server, run START-WASL.bat, then open the site at 127.0.0.1:8080. Your recordings are still saved."
        : "Audio analysis is currently unavailable. Your recordings are still saved and can be retried.";
      offline.cause = cause;
      throw offline;
    }
    var payload = null;
    try {
      payload = await response.json();
    } catch (ignore) {}
    if (!response.ok) {
      throw apiError(response, payload);
    }
    return payload;
  }

  function uploadRecording(assessmentId, task, blob, meta) {
    return global.WASL_STORE.putRecording(assessmentId, task, blob, meta).then(function (savedMeta) {
      return {
        ok: true,
        task: task,
        stored: true,
        location: "indexeddb",
        meta: savedMeta,
      };
    });
  }

  function modelTasks(assessment, recordings) {
    var available = recordings
      .filter(function (item) {
        return ANALYZABLE_TASKS.indexOf(item.task) !== -1;
      })
      .map(function (item) {
        return item.task;
      });
    var planned = (((assessment || {}).task_plan || {}).tasks || []).filter(function (task) {
      return ANALYZABLE_TASKS.indexOf(task) !== -1;
    });
    return planned.length ? planned : available;
  }

  async function prepareAndUpload(assessmentId) {
    await request("/api/health");
    var assessment = await global.WASL_STORE.getAssessment(assessmentId);
    var recordings = await global.WASL_STORE.listRecordingsMeta(assessmentId);
    assessment = assessment || { assessment_id: assessmentId };
    var tasks = modelTasks(assessment, recordings);
    if (!tasks.length) {
      var missing = new Error("No recordings are available");
      missing.code = "RECORDINGS_INCOMPLETE";
      missing.error_ar = "لا توجد تسجيلات مكتملة للتحليل.";
      missing.error_en = "No completed recordings are available for analysis.";
      throw missing;
    }
    var availableTasks = recordings.map(function (item) {
      return item.task;
    });
    var missingTasks = tasks.filter(function (task) {
      return availableTasks.indexOf(task) === -1;
    });
    if (missingTasks.length) {
      var incompletePlan = new Error("Planned recordings are incomplete");
      incompletePlan.code = "RECORDINGS_INCOMPLETE";
      incompletePlan.error_ar = "لم تكتمل جميع عينات خطة التقييم. ارجع إلى صفحة التسجيل وأكمل المهام.";
      incompletePlan.error_en = "The assessment recording plan is incomplete. Return to recording and finish all tasks.";
      throw incompletePlan;
    }

    await request("/api/assessments/" + encodeURIComponent(assessmentId), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consent: assessment.consent || {},
        expected_tasks: tasks,
        answers: assessment.answers || {},
        hearing: assessment.hearing || {},
        pointing_trials: assessment.pointing_trials || [],
        red_flags: assessment.red_flags || {},
      }),
    });

    for (var index = 0; index < tasks.length; index += 1) {
      var task = tasks[index];
      var recording = await global.WASL_STORE.getRecordingRaw(assessmentId, task);
      if (!recording || !recording.blob) {
        var incomplete = new Error("A planned recording is missing");
        incomplete.code = "RECORDINGS_INCOMPLETE";
        incomplete.error_ar = "أحد التسجيلات المطلوبة غير موجود. ارجع إلى صفحة التسجيل وأكمل العينة.";
        incomplete.error_en = "A required recording is missing. Return to recording and complete the sample.";
        throw incomplete;
      }
      var form = new FormData();
      var extension = recording.mime && recording.mime.indexOf("wav") !== -1 ? "wav" : "webm";
      form.append("task", task);
      form.append("audio", recording.blob, task + "." + extension);
      await request("/api/assessments/" + encodeURIComponent(assessmentId) + "/recordings", {
        method: "POST",
        body: form,
      });
    }
    return { assessment: assessment, tasks: tasks };
  }

  function health() {
    return request("/api/health");
  }

  async function analyze(assessmentId) {
    var prepared = await prepareAndUpload(assessmentId);
    var accepted = await request("/api/assessments/" + encodeURIComponent(assessmentId) + "/analyze", {
      method: "POST",
    });
    prepared.assessment.job = {
      job_id: accepted.job_id,
      status: "accepted",
      source: "model_api",
    };
    prepared.assessment.status = "processing";
    await global.WASL_STORE.putAssessment(prepared.assessment);
    await global.WASL_STORE.appendAudit(assessmentId, {
      event: "analysis_started",
      actor: "system",
      details: {
        job_id: accepted.job_id,
        source: "model_api",
        tasks: prepared.tasks,
      },
    });
    return accepted;
  }

  async function analysisStatus(assessmentId) {
    var assessment = await global.WASL_STORE.getAssessment(assessmentId);
    var jobId = assessment && assessment.job ? assessment.job.job_id : "";
    var query = jobId ? "?job_id=" + encodeURIComponent(jobId) : "";
    var status = await request(
      "/api/assessments/" + encodeURIComponent(assessmentId) + "/analysis-status" + query,
    );
    if (assessment && assessment.job) {
      assessment.job.status = status.status;
      assessment.status = status.status;
      await global.WASL_STORE.putAssessment(assessment);
    }
    return status;
  }

  async function getResult(assessmentId) {
    var assessment = await global.WASL_STORE.getAssessment(assessmentId);
    if (assessment && assessment.result && assessment.result.source === "model_api") {
      return assessment.result;
    }
    var result = await request("/api/assessments/" + encodeURIComponent(assessmentId) + "/result");
    assessment = assessment || { assessment_id: assessmentId };
    assessment.result = result;
    assessment.status = "completed";
    await global.WASL_STORE.putAssessment(assessment);
    await global.WASL_STORE.appendAudit(assessmentId, {
      event: "analysis_completed",
      actor: "system",
      details: {
        source: result.source,
        model_version: result.model_version,
      },
    });
    return result;
  }

  function toGuardianView(result) {
    if (!result) {
      return null;
    }
    return {
      assessment_id: result.assessment_id,
      priority: result.priority,
      recommended_service: result.recommended_service,
      matching_status: { code: "pending", count: 0 },
      next_step_ar: (result.evidence && result.evidence.next_recommended_step_ar) || "",
      next_step_en: (result.evidence && result.evidence.next_recommended_step_en) || "",
      requires_clinician_review: true,
    };
  }

  async function submitClinicalReview(assessmentId, decision) {
    var response = await request("/api/assessments/" + encodeURIComponent(assessmentId) + "/clinical-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(decision || {}),
    });
    await global.WASL_STORE.patchAssessment(assessmentId, {
      clinical_review: response.review,
      status: "clinically_reviewed",
    });
    return response;
  }

  async function requestRetake(assessmentId, task, reason) {
    var response = await request("/api/assessments/" + encodeURIComponent(assessmentId) + "/request-retake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: task, reason: reason || "" }),
    });
    var assessment = (await global.WASL_STORE.getAssessment(assessmentId)) || {
      assessment_id: assessmentId,
    };
    assessment.retake_requests = assessment.retake_requests || [];
    assessment.retake_requests.push({
      task: task,
      reason: reason || "",
      requested_at: new Date().toISOString(),
    });
    await global.WASL_STORE.putAssessment(assessment);
    return response;
  }

  global.WASL_API = {
    MODEL_CONNECTION: true,
    MODEL_VERSION: "API 3.2.0 · v37",
    API_BASE: API_BASE,
    STAGES: STAGES,
    newAssessmentId: newAssessmentId,
    uploadRecording: uploadRecording,
    analyze: analyze,
    analysisStatus: analysisStatus,
    getResult: getResult,
    toGuardianView: toGuardianView,
    submitClinicalReview: submitClinicalReview,
    requestRetake: requestRetake,
    health: health,
  };
})(window);
