"""Shared, standard-library-only validation for the portable map tools."""
from copy import deepcopy
from pathlib import Path
import json
import math


DEFAULT_MAP = {
    "showRoutes": True,
    "defaultCenter": [113.5, 32], "defaultZoom": 4.4, "minZoom": 1.4,
    "maxZoom": 17.8, "defaultPitch": 37, "defaultBearing": -9,
    "overviewMaxZoom": 5.5, "provinceDetailZoom": 8.7, "schoolZoom": 11.3,
    "closeUpZoom": 14.5, "regionLabelMaxZoom": 6.6, "schoolPointMinZoom": 6.4,
    "glyphsUrl": "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    "streetsSourceUrl": "https://tiles.openfreemap.org/planet",
}


class DataError(ValueError):
    """An actionable input-data error, safe to display on the command line."""


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise DataError(f"Duplicate JSON property: {key}")
        result[key] = value
    return result


def load_json(path):
    def invalid_constant(value):
        raise DataError(f"JSON contains a non-finite number: {value}")
    with Path(path).open(encoding="utf-8-sig") as handle:
        return json.load(handle, parse_constant=invalid_constant, object_pairs_hook=_unique_object)


def _object(value, label):
    if not isinstance(value, dict):
        raise DataError(f"{label} must be an object.")


def _array(value, label):
    if not isinstance(value, list):
        raise DataError(f"{label} must be an array.")


def _string(value, label, allow_null=False):
    if allow_null and value is None:
        return
    if not isinstance(value, str) or not value.strip():
        raise DataError(f"{label} must be a non-empty string{ ' or null' if allow_null else ''}.")


def _number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _finite_values(value, path="data"):
    if isinstance(value, float) and not math.isfinite(value):
        raise DataError(f"{path} contains NaN or Infinity.")
    if isinstance(value, dict):
        for key, item in value.items():
            _finite_values(item, f"{path}.{key}")
    elif isinstance(value, list):
        for i, item in enumerate(value):
            _finite_values(item, f"{path}[{i}]")


def validate_coordinates(record, label):
    """Unknown coordinates stay null; a partial, non-finite or invalid point fails."""
    lng, lat = record.get("lng"), record.get("lat")
    if lng is None and lat is None:
        return
    if not _number(lng) or not _number(lat):
        raise DataError(f"{label}.lng and .lat must both be finite numbers or both null.")
    if not -180 <= lng <= 180 or not -90 < lat < 90:
        raise DataError(f"{label} needs WGS84 longitude [-180,180] and latitude (-90,90).")
    if record.get("coordinateSystem", "WGS84") not in ("WGS84", "EPSG:4326"):
        raise DataError(f"{label}.coordinateSystem must be WGS84 or EPSG:4326; convert other coordinate systems first.")


def _place(record, label):
    for field in ("country", "province"):
        if field in record:
            _string(record[field], f"{label}.{field}", allow_null=True)
    validate_coordinates(record, label)


def validate_data(data):
    """Validate the input without modifying it or guessing missing information."""
    _object(data, "data")
    _finite_values(data)
    for field in ("meta", "schools", "students"):
        if field not in data:
            raise DataError(f"Missing required field: {field}")
    _object(data["meta"], "meta")
    for field in ("className", "homeCountry"):
        if field in data["meta"]:
            _string(data["meta"][field], f"meta.{field}")
    if "rosterComplete" in data["meta"] and not isinstance(data["meta"]["rosterComplete"], bool):
        raise DataError("meta.rosterComplete must be true or false.")
    if data.get("origin") is not None:
        _object(data["origin"], "origin")
        _string(data["origin"].get("name"), "origin.name")
        _place(data["origin"], "origin")
    _array(data["schools"], "schools")
    _array(data["students"], "students")
    school_ids, student_ids = set(), set()
    for i, school in enumerate(data["schools"]):
        label = f"schools[{i}]"
        _object(school, label)
        _string(school.get("id"), f"{label}.id")
        _string(school.get("name"), f"{label}.name")
        if school["id"] in school_ids:
            raise DataError(f"Duplicate school id: {school['id']}")
        school_ids.add(school["id"])
        _place(school, label)
    for i, student in enumerate(data["students"]):
        label = f"students[{i}]"
        _object(student, label)
        _string(student.get("id"), f"{label}.id")
        _string(student.get("name"), f"{label}.name")
        if student["id"] in student_ids:
            raise DataError(f"Duplicate student id: {student['id']}")
        student_ids.add(student["id"])
        school_id = student.get("schoolId")
        if school_id is not None:
            _string(school_id, f"{label}.schoolId")
            if school_id not in school_ids:
                raise DataError(f"{label}.schoolId references missing school: {school_id}")
        _place(student, label)
    regions = data.get("regions", [])
    _array(regions, "regions")
    region_names = set()
    for i, region in enumerate(regions):
        label = f"regions[{i}]"
        _object(region, label)
        _string(region.get("name"), f"{label}.name")
        if region["name"] in region_names:
            raise DataError(f"Duplicate region name: {region['name']}")
        region_names.add(region["name"])
        if "isCountry" in region and not isinstance(region["isCountry"], bool):
            raise DataError(f"{label}.isCountry must be true or false.")
        center = region.get("centroid")
        if center is not None:
            if not isinstance(center, list) or len(center) != 2 or not all(_number(n) for n in center):
                raise DataError(f"{label}.centroid must be a finite [longitude,latitude] pair or null.")
            validate_coordinates({"lng": center[0], "lat": center[1]}, label)
    config = data.get("map", {})
    _object(config, "map")
    if "showRoutes" in config and not isinstance(config["showRoutes"], bool):
        raise DataError("map.showRoutes must be true or false.")
    for key, value in config.items():
        if key in DEFAULT_MAP and _number(DEFAULT_MAP[key]) and not _number(value):
            raise DataError(f"map.{key} must be a finite number.")
    if "defaultCenter" in config:
        center = config["defaultCenter"]
        if not isinstance(center, list) or len(center) != 2 or not all(_number(n) for n in center):
            raise DataError("map.defaultCenter must be a finite [longitude,latitude] pair.")
        validate_coordinates({"lng": center[0], "lat": center[1]}, "map.defaultCenter")
    for key in ("glyphsUrl", "streetsSourceUrl"):
        if key in config:
            _string(config[key], f"map.{key}")
    config = {**DEFAULT_MAP, **config}
    if not 0 <= config["minZoom"] <= config["maxZoom"] <= 24:
        raise DataError("map zoom range must satisfy 0 <= minZoom <= maxZoom <= 24.")
    if not 0 <= config["defaultPitch"] <= 65:
        raise DataError("map.defaultPitch must be in [0,65].")
    return data


def current_data(data):
    """Copy current business records, omitting obsolete input-review metadata."""
    result = deepcopy(data)
    records = [result["meta"], result.get("origin"), *result["schools"], *result["students"]]
    obsolete = {"coordinateNote", "reviewNote", "researchNote", "nameCandidates",
                "nameCorrectionNote", "schoolOriginal", "schoolNameOriginal",
                "originalName"}
    for record in records:
        if not record:
            continue
        for key in list(record):
            if key in obsolete or key.startswith(("source", "ocr")) or key.endswith("Source"):
                del record[key]
    return result


def normalized_data(data):
    """Return a fresh object with presentation defaults; raw input is unchanged."""
    validate_data(data)
    result = current_data(data)
    result.setdefault("origin", None)
    result.setdefault("regions", [])
    result["map"] = {**deepcopy(DEFAULT_MAP), **result.get("map", {})}
    result["meta"] = {"className": "我们的班级", "homeCountry": "中国", "rosterComplete": False, **result["meta"]}
    return result


def write_json(path, data):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
