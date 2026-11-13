#!/usr/bin/env python3
"""Validate map data without changing the source or assigning missing coordinates.

`--report` adds a business-level reconciliation on top of the structural checks:
headcount against status buckets, regional distribution, shared schools, the
plausibility of every coordinate, and the distance from the mother school to each
destination. Those are the errors a structural validator cannot see — a school
pinned to the wrong city still looks perfectly valid.
"""
import argparse
import math
import sys
from collections import Counter, defaultdict

from data_tools import DataError, load_json, validate_data

# Distances beyond these are not proof of an error, but they are the first thing
# worth re-checking when a point looks wrong.
SAME_CITY_LIMIT_KM = 80
SAME_PROVINCE_LIMIT_KM = 600


def haversine_km(lat1, lng1, lat2, lng2):
    radius = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def build_report(data):
    """Return (lines, warnings) describing the roster the way a reader checks it."""
    meta = data.get("meta") or {}
    origin = data.get("origin") or {}
    schools = {s["id"]: s for s in data["schools"]}
    students = data["students"]
    lines, warnings = [], []

    lines.append("== 基本信息 ==")
    lines.append(f"班级: {meta.get('className', '(未填)')}  届别: {meta.get('year', '(未填)')}  "
                 f"名册声明完整: {meta.get('rosterComplete', False)}")

    # --- headcount by status bucket -------------------------------------
    placed = [s for s in students if s.get("schoolId")]
    unplaced = [s for s in students if not s.get("schoolId")]
    status_counts = Counter(s.get("status") or "(无状态)" for s in unplaced)
    lines.append("")
    lines.append("== 人数对账 ==")
    lines.append(f"总人数 {len(students)} = 已落点 {len(placed)} + 未落点 {len(unplaced)}")
    for name, count in status_counts.most_common():
        lines.append(f"  未落点 · {name}: {count}")
    if len(students) == 0:
        warnings.append("名单为空，页面会显示空状态")

    # --- regions ---------------------------------------------------------
    by_province, by_city = Counter(), Counter()
    for student in placed:
        school = schools.get(student["schoolId"])
        if not school:
            continue
        province = school.get("province") or "(缺省份)"
        by_province[province] += 1
        by_city[(province, school.get("city") or "(缺城市)")] += 1
    lines.append("")
    lines.append(f"== 地区分布（已落点 {len(placed)} 人，{len(by_province)} 个省级地区）==")
    for province, count in by_province.most_common():
        cities = "、".join(f"{city} {n}" for (p, city), n in by_city.items() if p == province)
        lines.append(f"  {province}: {count}（{cities}）")

    # --- shared schools --------------------------------------------------
    members = defaultdict(list)
    for student in placed:
        members[student["schoolId"]].append(student.get("name") or student["id"])
    shared = {sid: names for sid, names in members.items() if len(names) > 1}
    lines.append("")
    lines.append(f"== 学校 ==")
    lines.append(f"学校/校区 {len(schools)} 个，其中 {len(shared)} 所有多人：")
    for sid, names in shared.items():
        lines.append(f"  {schools[sid].get('name', sid)}: {'、'.join(names)} ({len(names)})")
    referenced = set(members)
    orphans = [sid for sid in schools if sid not in referenced]
    if orphans:
        warnings.append(f"{len(orphans)} 所学校没有任何学生引用: {', '.join(orphans[:5])}")

    # --- coordinates -----------------------------------------------------
    lines.append("")
    lines.append("== 坐标 ==")
    bad_coords, mismatched_city, distances = [], [], []
    for school in data["schools"]:
        lng, lat = school.get("lng"), school.get("lat")
        if lng is None or lat is None:
            continue
        if not (73 <= lng <= 136 and 3 <= lat <= 54):
            bad_coords.append(school.get("name", school["id"]))
        if not (73 <= lng <= 136 and 3 <= lat <= 54):
            continue
        city = (school.get("city") or "").replace("市", "")
        address = school.get("address") or ""
        if city and address and city not in address:
            mismatched_city.append(f"{school.get('name', school['id'])}（城市 {school.get('city')} / 地址 {address}）")
        if origin.get("lat") is not None and origin.get("lng") is not None:
            distances.append((haversine_km(origin["lat"], origin["lng"], lat, lng), school, city))
    lines.append(f"有坐标的学校 {sum(1 for s in data['schools'] if s.get('lng') is not None)} / {len(schools)}")
    if bad_coords:
        warnings.append(f"坐标落在国境范围外: {', '.join(bad_coords)}")
    if mismatched_city:
        warnings.append("城市名未出现在地址里（地址可能不规范，或城市字段填错）: " + "; ".join(mismatched_city))

    # --- distance plausibility -------------------------------------------
    if distances:
        origin_city = (origin.get("city") or "").replace("市", "")
        origin_province = origin.get("province") or ""
        for distance, school, city in sorted(distances, reverse=True, key=lambda row: row[0]):
            name = school.get("name", school["id"])
            campus = school.get("campus")
            lines.append(f"  {distance:7.1f} km  {name}{('·' + campus) if campus else ''}  [{school.get('city')}]")
            same_city = city and origin_city and city == origin_city
            same_province = school.get("province") == origin_province
            if same_city and distance > SAME_CITY_LIMIT_KM:
                warnings.append(f"同城却 {distance:.0f} km：{name}（{school.get('city')}），阈值 {SAME_CITY_LIMIT_KM} km")
            elif same_province and not same_city and distance > SAME_PROVINCE_LIMIT_KM:
                warnings.append(f"同省却 {distance:.0f} km：{name}（{school.get('city')}），阈值 {SAME_PROVINCE_LIMIT_KM} km")
    else:
        lines.append("  母校坐标缺失，跳过距离核对")

    # --- campus confirmation ---------------------------------------------
    buckets = Counter()
    for school in data["schools"]:
        status = school.get("campusStatus")
        if status == "user_confirmed":
            buckets["用户确认"] += 1
        elif status == "source_confirmed" or school.get("coordinateStatus") == "campus_confirmed":
            buckets["来源确认"] += 1
        elif status == "assumed":
            buckets["按主校区推定"] += 1
        else:
            buckets["未确认"] += 1
    lines.append("")
    lines.append("== 就读校区状态 ==")
    for name, count in buckets.most_common():
        lines.append(f"  {name}: {count}")

    return lines, warnings


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", required=True, help="UTF-8 JSON with meta, schools and students; schoolId:null and null coordinates are allowed.")
    parser.add_argument("--report", action="store_true", help="Print headcount, regions, shared schools, coordinate and distance reconciliation.")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero when the report raises warnings.")
    args = parser.parse_args(argv)
    try:
        data = validate_data(load_json(args.data))
    except (DataError, OSError, ValueError) as error:
        print(f"Validation failed: {error}", file=sys.stderr)
        return 1
    print(f"Valid: {len(data['students'])} student records; {len(data['schools'])} school/campus records. No source files changed.")
    if not args.report:
        return 0

    lines, warnings = build_report(data)
    for line in lines:
        print(line)
    if warnings:
        print("")
        print(f"== 需要复核 {len(warnings)} 项 ==")
        for item in warnings:
            print(f"  ! {item}")
        if args.strict:
            return 2
    else:
        print("")
        print("== 对账无异常 ==")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
