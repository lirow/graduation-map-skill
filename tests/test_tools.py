"""Portable CLI tests using only synthetic, non-personal records."""
from pathlib import Path
import base64
import copy
import json
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "skills" / "graduation-map" / "scripts"
sys.path.insert(0, str(SCRIPTS))


def sample():
    return {
        "meta": {"className": "示例班级", "year": 2020, "homeCountry": "中国", "rosterComplete": False},
        "origin": None,
        "schools": [{"id": "school-a", "name": "示例学校", "country": "中国", "province": "四川省", "lng": None, "lat": None}],
        "students": [
            {"id": "student-a", "name": "示例同学甲", "schoolId": "school-a", "nameStatus": "needs_review", "sourceLabel": "示例第1行"},
            {"id": "student-b", "name": "示例同学乙", "schoolId": None, "country": "中国", "province": "江苏省"},
        ],
    }


class ToolTests(unittest.TestCase):
    def run_cli(self, name, *args, cwd=None):
        return subprocess.run([sys.executable, str(SCRIPTS / name), *map(str, args)], cwd=cwd, capture_output=True, text=True)

    def write_json(self, path, value):
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
        return path

    def test_validation_accepts_incomplete_positions_and_does_not_invent_them(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.write_json(Path(tmp) / "input.json", sample())
            before = path.read_bytes()
            result = self.run_cli("validate_data.py", "--data", path)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(path.read_bytes(), before)

    def test_validation_rejects_duplicate_ids_missing_references_and_invalid_coordinates(self):
        cases = []
        data = sample(); data["students"].append(copy.deepcopy(data["students"][0])); cases.append(data)
        data = sample(); data["schools"].append(copy.deepcopy(data["schools"][0])); cases.append(data)
        data = sample(); data["students"][0]["schoolId"] = "missing"; cases.append(data)
        for lng, lat in [(True, 30), (200, 30), (100, 95), (100, None), (float("nan"), 30), (float("inf"), 30)]:
            data = sample(); data["schools"][0].update(lng=lng, lat=lat); cases.append(data)
        data = sample(); data["schools"][0]["province"] = ["四川省"]; cases.append(data)
        data = sample(); data["schools"][0].update(lng=100, lat=30, coordinateSystem="GCJ02"); cases.append(data)
        data = sample(); data["map"] = {"defaultCenter": [None, None]}; cases.append(data)
        with tempfile.TemporaryDirectory() as tmp:
            for i, value in enumerate(cases):
                with self.subTest(case=i):
                    result = self.run_cli("validate_data.py", "--data", self.write_json(Path(tmp) / f"case-{i}.json", value))
                    self.assertNotEqual(result.returncode, 0)
                    self.assertTrue(result.stderr.strip())

    def test_build_is_standalone_and_safe_from_other_working_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            value = sample()
            payload = '</script><script>globalThis.injected=true</script>\u2028'
            value["students"][0]["name"] = payload
            data = self.write_json(tmp / "input.json", value)
            output = tmp / "result.html"
            result = self.run_cli("build.py", "--data", data, "--output", output, cwd=tmp)
            self.assertEqual(result.returncode, 0, result.stderr)
            source = output.read_text(encoding="utf-8")
            self.assertNotIn(payload, source)
            self.assertIn(r"\u003c/script>", source)
            self.assertIn("const CLASS_INFO =", source)
            self.assertIn("const ALMA_MATER =", source)
            self.assertIn("const SCHOOLS =", source)
            self.assertIn("const GRADUATES =", source)
            self.assertIn("const REGION_CONFIG =", source)
            self.assertIn("const MAP_CONFIG =", source)
            self.assertNotRegex(source, r"/\*__[A-Z_]+__\*/")
            self.assertNotRegex(source, r'<script[^>]+src=')
            self.assertNotRegex(source, r'<link[^>]+rel=["\']stylesheet')
            self.assertRegex(source, r'<script type="text/plain" id="source-image">\s*</script>')
            self.assertNotIn(str(data), source)

    def test_build_embeds_image_only_when_explicitly_given(self):
        # A generated 1x1 transparent PNG, no source photograph or student data.
        image_bytes = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=")
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            image = tmp / "synthetic.png"; image.write_bytes(image_bytes)
            data = self.write_json(tmp / "input.json", sample())
            result = self.run_cli("build.py", "--data", data, "--output", tmp / "result.html", "--source-image", image)
            self.assertEqual(result.returncode, 0, result.stderr)
            html = (tmp / "result.html").read_text(encoding="utf-8")
            match = re.search(r'id="source-image">data:image/png;base64,([^<]+)</script>', html)
            self.assertIsNotNone(match)
            self.assertEqual(base64.b64decode(match[1]), image_bytes)

    def test_corrections_use_stable_ids_and_preserve_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            value = sample()
            value["students"][0]["sourceRect"] = [1, 2, 30, 10]
            value["students"][0]["reviewNote"] = "校区仍需用户确认。"
            data = self.write_json(tmp / "input.json", value)
            corrections = tmp / "corrections.csv"
            corrections.write_text("id,name\nstudent-b,更正同学乙\nstudent-a,更正同学甲\n", encoding="utf-8")
            result = self.run_cli("import_corrections.py", "--data", data, "--corrections", corrections, "--output", tmp / "corrected.json")
            self.assertEqual(result.returncode, 0, result.stderr)
            updated = json.loads((tmp / "corrected.json").read_text(encoding="utf-8"))
            self.assertEqual(updated["students"][0]["name"], "更正同学甲")
            self.assertEqual(updated["students"][1]["name"], "更正同学乙")
            self.assertEqual(updated["students"][0]["sourceRect"], [1, 2, 30, 10])
            self.assertEqual(updated["students"][0]["schoolId"], "school-a")
            self.assertEqual(updated["students"][0]["nameStatus"], "user_confirmed")
            self.assertEqual(updated["students"][0]["reviewNote"], "校区仍需用户确认。")
            self.assertIn("更正", updated["students"][0]["nameCorrectionNote"])
            self.assertEqual(json.loads(data.read_text(encoding="utf-8")), value)

    def test_corrections_reject_ambiguous_or_missing_ids_and_blank_names(self):
        inputs = ["id,name\nstudent-a,甲\nstudent-a,乙\n", "id,name\nmissing,甲\n", "id,name\nstudent-a,\n", "name\n甲\n"]
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp); data = self.write_json(tmp / "input.json", sample())
            for i, content in enumerate(inputs):
                with self.subTest(case=i):
                    corrections = tmp / f"bad-{i}.csv"; corrections.write_text(content, encoding="utf-8")
                    output = tmp / f"bad-{i}.json"
                    result = self.run_cli("import_corrections.py", "--data", data, "--corrections", corrections, "--output", output)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse(output.exists())

    def test_build_requires_explicit_output_and_does_not_overwrite_input(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.write_json(Path(tmp) / "input.json", sample()); before = path.read_bytes()
            result = self.run_cli("build.py", "--data", path)
            self.assertNotEqual(result.returncode, 0)
            result = self.run_cli("build.py", "--data", path, "--output", path)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(path.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
