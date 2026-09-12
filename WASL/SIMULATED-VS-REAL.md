# Integration status

## Implemented with the supplied real models

| Capability | Status |
|---|---|
| Browser audio capture and local quality checks | Implemented with MediaRecorder, Web Audio, and IndexedDB. |
| Consented server upload | Implemented; complete guardian consent is server-enforced. |
| Browser-format to WAV conversion | New recordings are encoded as PCM16 mono WAV in the browser; bounded FFmpeg is retained only for legacy formats. |
| 115-feature extraction | Implemented with Librosa and Praat-Parselmouth. |
| Dysarthria model inference | Real supplied Random Forest artifact. |
| Stuttering model inference | Real supplied Random Forest artifact. |
| Voice-disorder model inference | Real supplied XGBoost artifact within its Reinke-data scope. |
| Result validation | Implemented for all flags, scores, thresholds, and required conditions. |
| Model version traceability | Implemented through artifact SHA-256 and a bundle identifier. |
| Specialist per-sample output | Implemented without inventing one overall confidence score. |
| Clinical decision gate | Implemented; priority, pathway, and rationale are required. |
| Temporary server-audio deletion | Implemented after success or failure. |

No rule-based or random score generator is used by the running analysis path. Fake values exist only inside isolated automated tests.

## Still a product mock

Nafath verification, Sehhaty integration and booking, specialist authentication, facility availability, notifications, and production audit infrastructure are not connected to external production systems.

## Production work still required

- authenticated users and role-based authorization;
- TLS and managed encrypted storage;
- persistent database, job queue, and immutable audit trail;
- consent, retention, and deletion policy;
- malware scanning for hearing-report attachments;
- rate limiting, observability, and incident handling;
- model registry, signed artifacts, monitoring, and rollback;
- clinical, calibration, and fairness validation for the intended pediatric Arabic-speaking population.
