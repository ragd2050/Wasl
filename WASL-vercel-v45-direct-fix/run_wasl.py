"""Start the WASL website and embedded speech models as one service."""

from __future__ import annotations

import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser

import uvicorn


HOST = "127.0.0.1"
PORT = 8080
URL = f"http://{HOST}:{PORT}/"


def open_browser_when_ready() -> None:
    """Open the application only after the API and models report ready."""

    health_url = f"{URL}api/health"

    for _ in range(180):
        try:
            with urllib.request.urlopen(health_url, timeout=2) as response:
                if response.status == 200:
                    webbrowser.open(URL)
                    return
        except (OSError, urllib.error.URLError):
            pass

        time.sleep(1)

    print(
        "WASL did not become ready within three minutes. "
        "Review the error messages above."
    )


def main() -> None:
    if sys.version_info[:2] != (3, 11):
        raise SystemExit(
            "WASL requires Python 3.11 because the supplied model artifacts "
            "were validated with that runtime."
        )

    print("Starting WASL and the embedded AI speech models...")
    print(f"The application will open at {URL}")
    print("Keep this window open while using the application.")

    threading.Thread(
        target=open_browser_when_ready,
        daemon=True,
    ).start()
    uvicorn.run(
        "backend.connection_service:app",
        host=HOST,
        port=PORT,
        log_level="info",
    )


if __name__ == "__main__":
    main()
