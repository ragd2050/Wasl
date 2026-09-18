"""Run the real WASL model bundle over a directory of audio samples."""

from __future__ import annotations

import argparse
import asyncio
import csv
import sys

from pathlib import Path

from starlette.datastructures import UploadFile

import api


SUPPORTED_EXTENSIONS = {
    ".wav",
    ".mp3",
    ".flac",
    ".ogg",
    ".m4a",
    ".mp4",
}


async def analyze_sample(path: Path) -> dict:
    """Analyze one file through the same API function used in service."""

    with path.open("rb") as stream:
        upload = UploadFile(
            file=stream,
            filename=path.name,
        )
        response = await api.analyze_audio(
            upload
        )

    results = response["results"]
    extraction = response[
        "feature_extraction"
    ]

    return {
        "sample": path.name,
        "feature_count": extraction[
            "feature_count"
        ],
        "clinical_features": extraction[
            "clinical_voice_features"
        ],
        "dysarthria_score": results[
            "dysarthria"
        ]["probability"],
        "dysarthria_flag": results[
            "dysarthria"
        ]["detected"],
        "stuttering_score": results[
            "stuttering"
        ]["probability"],
        "stuttering_flag": results[
            "stuttering"
        ]["detected"],
        "voice_disorder_score": results[
            "voice_disorder"
        ]["probability"],
        "voice_disorder_flag": results[
            "voice_disorder"
        ]["detected"],
        "warnings": "|".join(
            extraction.get(
                "warnings",
                [],
            )
        ),
    }


async def run(samples_directory: Path) -> list[dict]:
    """Analyze all supported samples in filename order."""

    paths = sorted(
        path
        for path in samples_directory.iterdir()
        if path.is_file()
        and path.suffix.lower()
        in SUPPORTED_EXTENSIONS
    )

    if not paths:
        raise ValueError(
            "No supported audio files were found."
        )

    rows = []

    for path in paths:
        rows.append(
            await analyze_sample(path)
        )

    return rows


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Run a non-clinical smoke test over "
            "audio samples."
        )
    )
    parser.add_argument(
        "samples_directory",
        type=Path,
    )
    parser.add_argument(
        "--output",
        type=Path,
    )

    return parser.parse_args()


def main() -> None:
    arguments = parse_arguments()
    rows = asyncio.run(
        run(arguments.samples_directory)
    )
    fieldnames = list(rows[0])

    if arguments.output:
        output_stream = arguments.output.open(
            "w",
            encoding="utf-8",
            newline="",
        )
    else:
        output_stream = sys.stdout

    try:
        writer = csv.DictWriter(
            output_stream,
            fieldnames=fieldnames,
        )
        writer.writeheader()
        writer.writerows(rows)
    finally:
        if arguments.output:
            output_stream.close()


if __name__ == "__main__":
    main()
