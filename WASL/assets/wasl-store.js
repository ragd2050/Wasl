/* ============================================================================
 * WASL — Demo Persistence Layer  (Sehhaty Integration Service · storage side)
 * ----------------------------------------------------------------------------
 * Browser-side draft storage. Audio remains local until consented submission.
 * In production this whole file is replaced by real API calls to an encrypted
 * server-side datastore. For the demo it keeps ALL medical data — audio blobs,
 * questionnaire answers, hearing screening, AI results — inside IndexedDB
 * (NEVER localStorage).  localStorage is used ONLY for a small, non-sensitive
 * "resume pointer" (assessment id + current step). No names, IDs, or audio.
 *
 * Audio blobs are handed out only as short-lived object URLs created on demand
 * (mimicking temporary authorized URLs) and revoked by the caller after use.
 * ==========================================================================*/
(function (global) {
  "use strict";

  var DB_NAME = "wasl-demo";
  var DB_VERSION = 1;
  var RESUME_KEY = "waslResume"; // non-sensitive pointer only

  var _dbP = null;
  var _mem = null; // in-memory fallback if IndexedDB is unavailable (file:// edge cases)
  var _persistent = "indexedDB" in global;

  function memFallback() {
    _persistent = false;
    if (_mem) return _mem;
    console.warn(
      "[WASL_STORE] IndexedDB unavailable — using in-memory fallback (data will NOT persist across pages). Serve the site over http:// for full demo persistence.",
    );
    _mem = { assessments: {}, recordings: {} };
    return _mem;
  }

  function openDB() {
    if (_dbP) return _dbP;
    _dbP = new Promise(function (resolve, reject) {
      if (!("indexedDB" in global)) return reject(new Error("no-indexeddb"));
      var req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        return reject(e);
      }
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains("assessments"))
          db.createObjectStore("assessments", { keyPath: "assessment_id" });
        if (!db.objectStoreNames.contains("recordings")) db.createObjectStore("recordings", { keyPath: "id" });
      };
      req.onsuccess = function (e) {
        resolve(e.target.result);
      };
      req.onerror = function () {
        reject(req.error || new Error("open-failed"));
      };
      req.onblocked = function () {
        reject(new Error("blocked"));
      };
    }).catch(function (err) {
      _dbP = null; // allow retry, but signal fallback
      throw err;
    });
    return _dbP;
  }

  function tx(store, mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode);
        var s = t.objectStore(store);
        var out = fn(s);
        t.oncomplete = function () {
          resolve(out && out.__req ? out.__req.result : out);
        };
        t.onerror = function () {
          reject(t.error);
        };
        t.onabort = function () {
          reject(t.error || new Error("aborted"));
        };
      });
    });
  }

  /* ---- Assessments (metadata, answers, hearing, result, decision) ---- */

  function getAssessment(id) {
    return openDB()
      .then(function () {
        return tx("assessments", "readonly", function (s) {
          var r = s.get(id);
          return { __req: r };
        });
      })
      .catch(function () {
        var m = memFallback();
        return m.assessments[id] || null;
      });
  }

  function putAssessment(obj) {
    obj.updated_at = Date.now();
    return openDB()
      .then(function () {
        return tx("assessments", "readwrite", function (s) {
          s.put(obj);
          return obj;
        });
      })
      .catch(function () {
        var m = memFallback();
        m.assessments[obj.assessment_id] = obj;
        return obj;
      });
  }

  function patchAssessment(id, patch) {
    return getAssessment(id).then(function (cur) {
      cur = cur || { assessment_id: id, created_at: Date.now() };
      Object.keys(patch).forEach(function (k) {
        cur[k] = patch[k];
      });
      return putAssessment(cur);
    });
  }

  function appendAudit(id, event) {
    return getAssessment(id).then(function (cur) {
      cur = cur || { assessment_id: id, created_at: Date.now() };
      cur.audit_log = Array.isArray(cur.audit_log) ? cur.audit_log : [];
      cur.audit_log.push({
        event: event.event,
        actor: event.actor || "system",
        task: event.task || null,
        details: event.details || null,
        timestamp: event.timestamp || new Date().toISOString(),
      });
      return putAssessment(cur);
    });
  }

  function listAssessments() {
    return openDB()
      .then(function () {
        return tx("assessments", "readonly", function (s) {
          var r = s.getAll();
          return { __req: r };
        });
      })
      .catch(function () {
        var m = memFallback();
        return Object.keys(m.assessments).map(function (key) {
          return m.assessments[key];
        });
      })
      .then(function (items) {
        return (items || []).sort(function (a, b) {
          return (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0);
        });
      });
  }

  /* ---- Recordings (audio blobs + quality metadata) ---- */

  function recId(assessmentId, task) {
    return assessmentId + ":" + task;
  }

  function putRecording(assessmentId, task, blob, meta) {
    var rec = {
      id: recId(assessmentId, task),
      assessment_id: assessmentId,
      task: task,
      blob: blob, // stored as Blob, not a URL
      mime: (blob && blob.type) || "audio/webm",
      size: (blob && blob.size) || 0,
      duration_sec: (meta && meta.duration_sec) || 0,
      quality: (meta && meta.quality) || null,
      created_at: Date.now(),
    };
    return openDB()
      .then(function () {
        return tx("recordings", "readwrite", function (s) {
          s.put(rec);
          return rec;
        });
      })
      .catch(function () {
        var m = memFallback();
        m.recordings[rec.id] = rec;
        return rec;
      })
      .then(function (r) {
        // return a copy WITHOUT the blob for metadata use
        return {
          id: r.id,
          task: r.task,
          mime: r.mime,
          size: r.size,
          duration_sec: r.duration_sec,
          quality: r.quality,
          created_at: r.created_at,
        };
      });
  }

  function getRecordingRaw(assessmentId, task) {
    return openDB()
      .then(function () {
        return tx("recordings", "readonly", function (s) {
          var r = s.get(recId(assessmentId, task));
          return { __req: r };
        });
      })
      .catch(function () {
        var m = memFallback();
        return m.recordings[recId(assessmentId, task)] || null;
      });
  }

  function listRecordingsMeta(assessmentId) {
    return openDB()
      .then(function (db) {
        return new Promise(function (resolve) {
          var out = [];
          var t = db.transaction("recordings", "readonly");
          var cur = t.objectStore("recordings").openCursor();
          cur.onsuccess = function (e) {
            var c = e.target.result;
            if (c) {
              var v = c.value;
              if (v.assessment_id === assessmentId)
                out.push({
                  id: v.id,
                  task: v.task,
                  mime: v.mime,
                  size: v.size,
                  duration_sec: v.duration_sec,
                  quality: v.quality,
                  created_at: v.created_at,
                });
              c.continue();
            } else resolve(out);
          };
          cur.onerror = function () {
            resolve(out);
          };
        });
      })
      .catch(function () {
        var m = memFallback();
        return Object.keys(m.recordings)
          .map(function (k) {
            return m.recordings[k];
          })
          .filter(function (v) {
            return v.assessment_id === assessmentId;
          })
          .map(function (v) {
            return {
              id: v.id,
              task: v.task,
              mime: v.mime,
              size: v.size,
              duration_sec: v.duration_sec,
              quality: v.quality,
              created_at: v.created_at,
            };
          });
      });
  }

  function deleteRecording(assessmentId, task) {
    return openDB()
      .then(function () {
        return tx("recordings", "readwrite", function (s) {
          s.delete(recId(assessmentId, task));
          return true;
        });
      })
      .catch(function () {
        var m = memFallback();
        delete m.recordings[recId(assessmentId, task)];
        return true;
      });
  }

  /* Temporary authorized URL — created on demand, caller must revoke. */
  function getRecordingURL(assessmentId, task) {
    return getRecordingRaw(assessmentId, task).then(function (r) {
      if (!r || !r.blob) return null;
      return URL.createObjectURL(r.blob);
    });
  }

  function clearAssessment(id) {
    return listRecordingsMeta(id)
      .then(function (list) {
        return Promise.all(
          list.map(function (m) {
            return deleteRecording(id, m.task);
          }),
        );
      })
      .then(function () {
        return openDB()
          .then(function () {
            return tx("assessments", "readwrite", function (s) {
              s.delete(id);
              return true;
            });
          })
          .catch(function () {
            var m = memFallback();
            delete m.assessments[id];
            return true;
          });
      });
  }

  /* ---- Non-sensitive resume pointer (localStorage is OK here) ---- */
  function setResume(ptr) {
    try {
      var safe = {
        assessment_id: ptr.assessment_id,
        url: ptr.url,
        step: ptr.step,
        label_ar: ptr.label_ar,
        label_en: ptr.label_en,
        ts: Date.now(),
      };
      localStorage.setItem(RESUME_KEY, JSON.stringify(safe));
    } catch (e) {}
  }
  function getResume() {
    try {
      return JSON.parse(localStorage.getItem(RESUME_KEY) || "null");
    } catch (e) {
      return null;
    }
  }
  function clearResume() {
    try {
      localStorage.removeItem(RESUME_KEY);
    } catch (e) {}
  }

  /* Get-or-create the current assessment id (kept in the non-sensitive pointer). */
  function newAssessmentId() {
    var d = new Date(),
      n = String(1000 + Math.floor(Math.random() * 9000));
    return "WSL-" + d.getFullYear() + "-" + n.slice(1);
  }
  function ensureAssessmentId(step) {
    var r = getResume();
    if (r && r.assessment_id) return r.assessment_id;
    var id = newAssessmentId();
    setResume({ assessment_id: id, step: step || "assessment" });
    return id;
  }

  global.WASL_STORE = {
    ready: openDB,
    getAssessment: getAssessment,
    putAssessment: putAssessment,
    patchAssessment: patchAssessment,
    appendAudit: appendAudit,
    listAssessments: listAssessments,
    putRecording: putRecording,
    getRecordingRaw: getRecordingRaw,
    getRecordingURL: getRecordingURL,
    listRecordingsMeta: listRecordingsMeta,
    deleteRecording: deleteRecording,
    clearAssessment: clearAssessment,
    setResume: setResume,
    getResume: getResume,
    clearResume: clearResume,
    newAssessmentId: newAssessmentId,
    ensureAssessmentId: ensureAssessmentId,
    isPersistent: function () {
      return _persistent;
    },
  };
})(window);
