#!/usr/bin/env python3
"""Apply a user-verified CSV of id,name corrections using stable student IDs."""
import argparse
from copy import deepcopy
import csv
from datetime import date
from pathlib import Path
import sys
from data_tools import DataError, load_json, validate_data, write_json


def import_corrections(data, corrections_path):
    validate_data(data)
    records = {student["id"]: student for student in data["students"]}
    corrections = {}
    with Path(corrections_path).open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or reader.fieldnames != ["id", "name"]:
            raise DataError("Correction CSV must have exactly the header id,name.")
        for line_number, row in enumerate(reader, 2):
            if None in row:
                raise DataError(f"CSV line {line_number} has extra cells; quote names containing commas.")
            student_id, name = (row.get("id") or "").strip(), (row.get("name") or "").strip()
            if not student_id or not name:
                raise DataError(f"CSV line {line_number} requires a non-empty id and name.")
            if student_id in corrections:
                raise DataError(f"Duplicate correction id: {student_id}")
            if student_id not in records:
                raise DataError(f"Unknown correction id: {student_id}")
            corrections[student_id] = name
    if not corrections:
        raise DataError("Correction CSV contains no records.")
    updated = deepcopy(data)
    for student in updated["students"]:
        if student["id"] not in corrections:
            continue
        student.setdefault("ocrName", student["name"])
        student.setdefault("ocrCandidates", deepcopy(student.get("nameCandidates", [])))
        student["name"] = corrections[student["id"]]
        student["nameStatus"] = "user_confirmed"
        student["nameCandidates"] = []
        student["nameSource"] = "用户校对 CSV（按稳定 id 匹配）"
        student["nameConfirmedDate"] = date.today().isoformat()
        student["nameCorrectionNote"] = "姓名已按用户提供的校对结果更正；其他备注与原图信息保留用于对照。"
    return updated, len(corrections)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", required=True, help="Input map-data JSON.")
    parser.add_argument("--corrections", required=True, help="UTF-8 CSV with exactly id,name columns. Row order is irrelevant.")
    parser.add_argument("--output", required=True, help="Destination JSON; must differ from both input files.")
    args = parser.parse_args(argv)
    try:
        if Path(args.output).resolve() in (Path(args.data).resolve(), Path(args.corrections).resolve()):
            raise DataError("Output must differ from the data and corrections inputs.")
        updated, count = import_corrections(load_json(args.data), args.corrections)
        write_json(args.output, updated)
    except (DataError, OSError, ValueError, csv.Error) as error:
        print(f"Correction import failed: {error}", file=sys.stderr)
        return 1
    print(f"Applied {count} verified names to {args.output}. Input files and source evidence are unchanged.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
