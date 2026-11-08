#!/usr/bin/env python3
"""Validate map data without changing the source or assigning missing coordinates."""
import argparse
import sys
from data_tools import DataError, load_json, validate_data


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", required=True, help="UTF-8 JSON with meta, schools and students; schoolId:null and null coordinates are allowed.")
    args = parser.parse_args(argv)
    try:
        data = validate_data(load_json(args.data))
    except (DataError, OSError, ValueError) as error:
        print(f"Validation failed: {error}", file=sys.stderr)
        return 1
    print(f"Valid: {len(data['students'])} student records; {len(data['schools'])} school/campus records. No source files changed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
