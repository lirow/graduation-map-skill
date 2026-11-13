#!/usr/bin/env python3
"""Convert coordinates between WGS84, GCJ-02 and BD-09.

The page renders on a WGS84 basemap, but most Chinese POI sources return
GCJ-02 (Tencent/Amap) or BD-09 (Baidu). Feeding those values straight into
the map shifts every point by 100-700 m without any visible error, so convert
first and keep `coordinateSystem: "WGS84"` honest.

Python standard library only.

Examples
--------
    python3 coord.py --from gcj --to wgs --lat 30.610498 --lng 103.980005
    python3 coord.py --from gcj --to wgs --file points.json
    python3 coord.py --selftest

`--file` accepts a JSON list of objects with `lat` and `lng`; any other keys
(such as `name`) are preserved in the output.
"""
import argparse
import json
import math
import sys

A = 6378245.0
EE = 0.00669342162296594323
X_PI = math.pi * 3000.0 / 180.0


def out_of_china(lat, lng):
    """GCJ-02 obfuscation only applies inside China's surveying boundary."""
    return not (72.004 <= lng <= 137.8347 and 0.8293 <= lat <= 55.8271)


def _tf_lat(x, y):
    ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
    ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    ret += (20.0 * math.sin(y * math.pi) + 40.0 * math.sin(y / 3.0 * math.pi)) * 2.0 / 3.0
    ret += (160.0 * math.sin(y / 12.0 * math.pi) + 320.0 * math.sin(y * math.pi / 30.0)) * 2.0 / 3.0
    return ret


def _tf_lng(x, y):
    ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
    ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    ret += (20.0 * math.sin(x * math.pi) + 40.0 * math.sin(x / 3.0 * math.pi)) * 2.0 / 3.0
    ret += (150.0 * math.sin(x / 12.0 * math.pi) + 300.0 * math.sin(x / 30.0 * math.pi)) * 2.0 / 3.0
    return ret


def wgs2gcj(lat, lng):
    """WGS84 -> GCJ-02."""
    if out_of_china(lat, lng):
        return lat, lng
    dlat = _tf_lat(lng - 105.0, lat - 35.0)
    dlng = _tf_lng(lng - 105.0, lat - 35.0)
    radlat = lat / 180.0 * math.pi
    magic = 1 - EE * math.sin(radlat) ** 2
    sqrtmagic = math.sqrt(magic)
    dlat = (dlat * 180.0) / ((A * (1 - EE)) / (magic * sqrtmagic) * math.pi)
    dlng = (dlng * 180.0) / (A / sqrtmagic * math.cos(radlat) * math.pi)
    return lat + dlat, lng + dlng


def gcj2wgs(lat, lng, iterations=3):
    """GCJ-02 -> WGS84.

    A single subtraction of the forward offset leaves a ~1 m residue, so the
    inverse is iterated until the forward transform reproduces the input.
    """
    if out_of_china(lat, lng):
        return lat, lng
    wlat, wlng = lat, lng
    for _ in range(iterations):
        glat, glng = wgs2gcj(wlat, wlng)
        wlat -= glat - lat
        wlng -= glng - lng
    return wlat, wlng


def gcj2bd(lat, lng):
    """GCJ-02 -> BD-09."""
    z = math.sqrt(lng * lng + lat * lat) + 0.00002 * math.sin(lat * X_PI)
    theta = math.atan2(lat, lng) + 0.000003 * math.cos(lng * X_PI)
    return z * math.sin(theta) + 0.006, z * math.cos(theta) + 0.0065


def bd2gcj(lat, lng):
    """BD-09 -> GCJ-02."""
    x = lng - 0.0065
    y = lat - 0.006
    z = math.sqrt(x * x + y * y) - 0.00002 * math.sin(y * X_PI)
    theta = math.atan2(y, x) - 0.000003 * math.cos(x * X_PI)
    return z * math.sin(theta), z * math.cos(theta)


def bd2wgs(lat, lng):
    """BD-09 -> WGS84 (Baidu -> GCJ -> WGS84)."""
    return gcj2wgs(*bd2gcj(lat, lng))


def wgs2bd(lat, lng):
    """WGS84 -> BD-09."""
    return gcj2bd(*wgs2gcj(lat, lng))


CONVERTERS = {
    ("gcj", "wgs"): gcj2wgs,
    ("wgs", "gcj"): wgs2gcj,
    ("gcj", "bd"): gcj2bd,
    ("bd", "gcj"): bd2gcj,
    ("bd", "wgs"): bd2wgs,
    ("wgs", "bd"): wgs2bd,
}


def offset_meters(lat1, lng1, lat2, lng2):
    return math.hypot((lng2 - lng1) * 111320.0 * math.cos(math.radians(lat1)), (lat2 - lat1) * 110540.0)


def selftest():
    """Round-trip, known-point and passthrough checks. Returns a list of failures."""
    failures = []

    # 1) Round trip WGS -> GCJ -> WGS must return within a decimetre.
    for lat, lng, label in ((30.610498, 103.980005, "成都"), (39.9042, 116.4074, "北京"),
                            (22.5431, 114.0579, "深圳"), (45.5586, 84.9440, "克拉玛依")):
        back = gcj2wgs(*wgs2gcj(lat, lng))
        err = offset_meters(lat, lng, back[0], back[1])
        if err > 0.15:
            failures.append(f"round trip {label} drift {err:.3f} m")

    # 2) A known GCJ-02 point (Tiananmen from Tencent) must land near its
    #    WGS84 position, and the correction must be in the usual 100-700 m band.
    gcj = (39.908692, 116.397477)
    wgs = gcj2wgs(*gcj)
    if abs(wgs[0] - 39.9073) > 0.003 or abs(wgs[1] - 116.3912) > 0.003:
        failures.append(f"known point off target: {wgs}")
    shift = offset_meters(gcj[0], gcj[1], wgs[0], wgs[1])
    if not 100 <= shift <= 700:
        failures.append(f"GCJ shift out of expected band: {shift:.0f} m")

    # 3) Outside China the coordinates must pass through untouched.
    for lat, lng, label in ((35.681236, 139.767125, "东京"), (-33.8688, 151.2093, "悉尼")):
        if wgs2gcj(lat, lng) != (lat, lng) or gcj2wgs(lat, lng) != (lat, lng):
            failures.append(f"outside China not passed through: {label}")

    # 4) BD-09 round trip.
    for lat, lng in ((30.610498, 103.980005), (39.9042, 116.4074)):
        back = bd2gcj(*gcj2bd(lat, lng))
        if offset_meters(lat, lng, back[0], back[1]) > 0.15:
            failures.append(f"BD round trip drift at {lat},{lng}")

    return failures


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--from", dest="src", choices=["wgs", "gcj", "bd"], help="Source system")
    parser.add_argument("--to", dest="dst", choices=["wgs", "gcj", "bd"], help="Target system")
    parser.add_argument("--lat", type=float, help="Latitude of a single point")
    parser.add_argument("--lng", type=float, help="Longitude of a single point")
    parser.add_argument("--file", help="JSON list of {lat, lng, ...} objects to convert in place")
    parser.add_argument("--selftest", action="store_true", help="Run built-in checks and exit")
    args = parser.parse_args(argv)

    if args.selftest:
        failures = selftest()
        if failures:
            for item in failures:
                print(f"FAIL {item}", file=sys.stderr)
            return 1
        print("coord selftest passed: round trip, known point, offset band, passthrough, BD-09")
        return 0

    if not args.src or not args.dst:
        parser.error("--from and --to are required unless --selftest is used")
    if args.src == args.dst:
        parser.error("--from and --to must differ")
    convert = CONVERTERS[(args.src, args.dst)]

    if args.file:
        with open(args.file, encoding="utf-8") as handle:
            points = json.load(handle)
        if not isinstance(points, list):
            parser.error("--file must contain a JSON list")
        result = []
        for item in points:
            lat, lng = float(item["lat"]), float(item["lng"])
            new_lat, new_lng = convert(lat, lng)
            merged = {**item, "lat": round(new_lat, 6), "lng": round(new_lng, 6)}
            merged["shiftMeters"] = round(offset_meters(lat, lng, new_lat, new_lng), 1)
            result.append(merged)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    if args.lat is None or args.lng is None:
        parser.error("provide --lat and --lng, or --file")
    lat, lng = convert(args.lat, args.lng)
    print(json.dumps({"lat": round(lat, 6), "lng": round(lng, 6),
                      "shiftMeters": round(offset_meters(args.lat, args.lng, lat, lng), 1)},
                     ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
