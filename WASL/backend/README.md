# WASL connection service

- `connection_service.py`: same-origin web server, upload endpoints, analysis jobs, clinical-review gate and temporary-recording lifecycle.
- `model_gateway.py`: strict adapter for the real model API version 3.2.0.
- `tests/`: integration tests using a fake provider. Test scores never enter the application runtime.

Run from the project root:

```bash
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.connection_service:app --host 127.0.0.1 --port 8080
```

The supplied model API is embedded by default. Set `WASL_MODEL_URL` only when connecting to a separately deployed model service.
