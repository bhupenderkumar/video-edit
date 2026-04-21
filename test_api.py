#!/usr/bin/env python3
"""
ClipAI — End-to-end API test script.
Bypasses browser network restrictions by testing all endpoints directly.

Usage:
    python3 test_api.py                          # run all tests (uses movie in Documents)
    python3 test_api.py --video /path/to/file.mp4  # specify a video file
    python3 test_api.py --skip-process             # upload only, don't trigger AI processing
"""

import argparse
import json
import os
import sys
import time
import tempfile
from pathlib import Path

import requests

BASE_URL = "http://localhost:3001"
DEFAULT_VIDEO = os.path.expanduser(
    "~/Documents/Movie on 05-02-26 at 5.44\u202fPM.mov"
)

# ── helpers ──────────────────────────────────────────────────────────────────

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

passed = 0
failed = 0


def header(msg):
    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}{CYAN}  {msg}{RESET}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}")


def test(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  {GREEN}✓ {name}{RESET}")
    else:
        failed += 1
        print(f"  {RED}✗ {name}{RESET}")
        if detail:
            print(f"    {RED}→ {detail}{RESET}")


def info(msg):
    print(f"  {YELLOW}ℹ {msg}{RESET}")


# ── 1. Health check ─────────────────────────────────────────────────────────

def test_health():
    header("1. Health Check — Server Reachable")
    try:
        r = requests.get(f"{BASE_URL}/api/projects", timeout=10)
        test("Server responds", r.status_code == 200, f"status={r.status_code}")
        data = r.json()
        test("Returns JSON with projects array", "projects" in data)
        info(f"Existing projects: {len(data.get('projects', []))}")
    except requests.ConnectionError:
        test("Server responds", False, f"Cannot connect to {BASE_URL}. Is the dev server running?")
        print(f"\n{RED}Server not reachable. Start it with: npm run dev -- --port 3001{RESET}")
        sys.exit(1)


# ── 2. Profile CRUD ─────────────────────────────────────────────────────────

def test_profile():
    header("2. Profile — GET & PUT")

    # GET
    r = requests.get(f"{BASE_URL}/api/profile")
    test("GET /api/profile returns 200", r.status_code == 200)
    data = r.json()
    test("Has profile key", "profile" in data)
    if data.get("profile"):
        info(f"Current business: {data['profile'].get('business_name', '(empty)')}")

    # PUT
    payload = {
        "business_name": "Test Bakery (pytest)",
        "industry": "bakery",
        "brand_description": "A cozy neighborhood bakery specializing in sourdough.",
        "target_audience": "Local families and food lovers",
        "brand_tone": "warm",
    }
    r = requests.put(f"{BASE_URL}/api/profile", json=payload)
    test("PUT /api/profile returns 200", r.status_code == 200)
    data = r.json()
    test("Profile updated", data.get("message") == "Profile updated")
    test(
        "Business name persisted",
        data.get("profile", {}).get("business_name") == "Test Bakery (pytest)",
    )

    # Verify with GET
    r = requests.get(f"{BASE_URL}/api/profile")
    data = r.json()
    test(
        "GET reflects update",
        data.get("profile", {}).get("business_name") == "Test Bakery (pytest)",
    )


# ── 3. Video Upload ─────────────────────────────────────────────────────────

def test_upload(video_path):
    header("3. Video Upload — POST /api/upload")

    if not os.path.isfile(video_path):
        test("Video file exists", False, f"Not found: {video_path}")
        return None

    file_size = os.path.getsize(video_path)
    file_name = os.path.basename(video_path)
    info(f"File: {file_name} ({file_size / 1024 / 1024:.1f} MB)")

    # Determine content type
    ext = Path(video_path).suffix.lower()
    mime_map = {".mp4": "video/mp4", ".mov": "video/quicktime", ".avi": "video/x-msvideo", ".webm": "video/webm"}
    content_type = mime_map.get(ext, "video/mp4")

    with open(video_path, "rb") as f:
        files = {"video": (file_name, f, content_type)}
        data = {
            "title": "Python Test Upload",
            "target_platform": "youtube_shorts",
            "target_duration": "60",
        }
        info("Uploading...")
        r = requests.post(f"{BASE_URL}/api/upload", files=files, data=data, timeout=120)

    test("POST /api/upload returns 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    if r.status_code != 200:
        return None

    resp = r.json()
    project_id = resp.get("id")
    test("Returns project ID", project_id is not None)
    test("Status is 'uploaded'", resp.get("status") == "uploaded")
    test("Title matches", resp.get("title") == "Python Test Upload")
    info(f"Project ID: {project_id}")
    return project_id


# ── 4. Project Detail ───────────────────────────────────────────────────────

def test_project_detail(project_id):
    header("4. Project Detail — GET /api/projects/[id]")

    r = requests.get(f"{BASE_URL}/api/projects/{project_id}")
    test("GET /api/projects/<id> returns 200", r.status_code == 200)
    data = r.json()
    test("Has id", data.get("id") == project_id)
    test("Has status", "status" in data)
    test("Has title", data.get("title") == "Python Test Upload")
    info(f"Status: {data.get('status')}")
    info(f"Platform: {data.get('target_platform')}")


# ── 5. Status Check ─────────────────────────────────────────────────────────

def test_status(project_id):
    header("5. Status Check — GET /api/status/[id]")

    r = requests.get(f"{BASE_URL}/api/status/{project_id}")
    test("GET /api/status/<id> returns 200", r.status_code == 200)
    data = r.json()
    test("Has status field", "status" in data)
    test("Has id field", data.get("id") == project_id)
    info(f"Current status: {data.get('status')}")
    return data.get("status")


# ── 6. Trigger Processing ───────────────────────────────────────────────────

def test_process(project_id):
    header("6. Trigger AI Processing — POST /api/process")

    r = requests.post(f"{BASE_URL}/api/process", json={"projectId": project_id})
    test("POST /api/process returns 200", r.status_code == 200, f"status={r.status_code} body={r.text[:300]}")
    if r.status_code == 200:
        data = r.json()
        test("Message confirms start", "started" in data.get("message", "").lower())
        info("Processing started in background")


# ── 7. Poll Status ──────────────────────────────────────────────────────────

def test_poll_status(project_id, max_wait=300):
    header("7. Poll Processing Status (up to 5 min)")

    terminal_states = {"completed", "failed"}
    start = time.time()
    last_status = ""

    while time.time() - start < max_wait:
        r = requests.get(f"{BASE_URL}/api/status/{project_id}")
        if r.status_code != 200:
            info(f"Status check failed: {r.status_code}")
            time.sleep(3)
            continue

        data = r.json()
        status = data.get("status", "unknown")

        if status != last_status:
            elapsed = int(time.time() - start)
            info(f"[{elapsed:>3}s] Status: {status}")
            last_status = status

        if status in terminal_states:
            break

        time.sleep(3)

    elapsed = int(time.time() - start)
    test(f"Reached terminal state in {elapsed}s", last_status in terminal_states, f"final status: {last_status}")

    if last_status == "completed":
        test("Processing completed successfully", True)
    elif last_status == "failed":
        error_msg = data.get("error_message", "unknown error")
        test("Processing completed successfully", False, f"Error: {error_msg}")
    else:
        test("Processing completed in time", False, f"Timed out at status: {last_status}")

    return last_status


# ── 8. Download ──────────────────────────────────────────────────────────────

def test_download(project_id):
    header("8. Download Edited Video — GET /api/download/[id]")

    r = requests.get(f"{BASE_URL}/api/download/{project_id}", stream=True)
    test("GET /api/download/<id> returns 200", r.status_code == 200, f"status={r.status_code}")

    if r.status_code == 200:
        content_type = r.headers.get("content-type", "")
        test("Content-Type is video", "video" in content_type, content_type)

        disposition = r.headers.get("content-disposition", "")
        test("Has Content-Disposition", "attachment" in disposition, disposition)

        # Save to Downloads folder
        total = 0
        downloads_dir = os.path.expanduser("~/Downloads")
        out_path = os.path.join(downloads_dir, "clipai_edited_video.mp4")
        with open(out_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
                total += len(chunk)

        test("Downloaded file is non-empty", total > 0, f"size={total} bytes")
        info(f"Saved to: {out_path} ({total / 1024 / 1024:.1f} MB)")
        info(f"Open with: open \"{out_path}\"")


# ── 9. Photo Enhancement ────────────────────────────────────────────────────

def test_photo_enhancement():
    header("9. Photo Enhancement — POST /api/photos")

    # Create a small test image (100x100 red square PNG)
    # Minimal valid PNG with IHDR + IDAT + IEND
    try:
        from PIL import Image
        img = Image.new("RGB", (100, 100), color=(200, 100, 50))
        tmp = os.path.join(tempfile.gettempdir(), "clipai_test_photo.png")
        img.save(tmp)
        info("Created test image with Pillow (100×100)")
    except ImportError:
        # No Pillow — create a minimal JPEG via raw bytes trick
        # Use FFmpeg to create a test image instead
        tmp = os.path.join(tempfile.gettempdir(), "clipai_test_photo.png")
        os.system(f'ffmpeg -y -f lavfi -i color=c=orange:s=100x100:d=1 -frames:v 1 "{tmp}" 2>/dev/null')
        if not os.path.exists(tmp):
            info("Cannot create test image (no Pillow or FFmpeg). Skipping photo test.")
            return
        info("Created test image with FFmpeg (100×100)")

    with open(tmp, "rb") as f:
        files = {"photo": ("test_photo.png", f, "image/png")}
        data = {"enhancement_type": "auto"}
        r = requests.post(f"{BASE_URL}/api/photos", files=files, data=data, timeout=60)

    test("POST /api/photos returns 200", r.status_code == 200, f"status={r.status_code} body={r.text[:300]}")

    if r.status_code == 200:
        resp = r.json()
        photo_id = resp.get("id")
        test("Returns job ID", photo_id is not None)
        test("Has original dimensions", "original" in resp)
        test("Has enhanced info", "enhanced" in resp)

        if resp.get("original"):
            info(f"Original: {resp['original'].get('width')}×{resp['original'].get('height')}")
        if resp.get("enhanced"):
            info(f"Enhanced: {resp['enhanced'].get('width')}×{resp['enhanced'].get('height')}")

        # Download enhanced photo
        if photo_id:
            r2 = requests.get(f"{BASE_URL}/api/photos/{photo_id}")
            test("GET /api/photos/<id> returns 200", r2.status_code == 200)
            if r2.status_code == 200:
                test("Enhanced photo is non-empty", len(r2.content) > 0, f"{len(r2.content)} bytes")


# ── 10. Project List & Delete ────────────────────────────────────────────────

def test_list_and_delete(project_id):
    header("10. List Projects & Delete")

    # List
    r = requests.get(f"{BASE_URL}/api/projects")
    test("GET /api/projects returns 200", r.status_code == 200)
    data = r.json()
    projects = data.get("projects", [])
    test("Projects list is non-empty", len(projects) > 0)

    found = any(p.get("id") == project_id for p in projects)
    test("Our test project appears in list", found)

    # Delete
    r = requests.delete(f"{BASE_URL}/api/projects", params={"id": project_id})
    test("DELETE /api/projects?id=<id> returns 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        data = r.json()
        test("Delete confirmed", "deleted" in data.get("message", "").lower())

    # Verify deleted
    r = requests.get(f"{BASE_URL}/api/projects/{project_id}")
    test("Project no longer found", r.status_code == 404)


# ── 11. Error handling ───────────────────────────────────────────────────────

def test_error_handling():
    header("11. Error Handling")

    # Non-existent project
    r = requests.get(f"{BASE_URL}/api/projects/nonexistent-id-12345")
    test("GET unknown project returns 404", r.status_code == 404)

    r = requests.get(f"{BASE_URL}/api/status/nonexistent-id-12345")
    test("GET unknown status returns 404", r.status_code == 404)

    r = requests.get(f"{BASE_URL}/api/download/nonexistent-id-12345")
    test("GET unknown download returns 404", r.status_code == 404)

    # Upload without file
    r = requests.post(f"{BASE_URL}/api/upload", data={"title": "no file"})
    test("Upload without file returns 400", r.status_code == 400)

    # Process without projectId
    r = requests.post(f"{BASE_URL}/api/process", json={})
    test("Process without projectId returns 400", r.status_code == 400)


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    global BASE_URL

    parser = argparse.ArgumentParser(description="ClipAI API Test Suite")
    parser.add_argument("--video", default=DEFAULT_VIDEO, help="Path to video file to upload")
    parser.add_argument("--skip-process", action="store_true", help="Skip AI processing (upload only)")
    parser.add_argument("--skip-delete", action="store_true", help="Keep the test project after tests")
    parser.add_argument("--base-url", default=BASE_URL, help="Server base URL")
    args = parser.parse_args()

    BASE_URL = args.base_url

    print(f"\n{BOLD}ClipAI API Test Suite{RESET}")
    print(f"Server: {BASE_URL}")
    print(f"Video:  {args.video}")
    print(f"Skip processing: {args.skip_process}")

    # Run tests
    test_health()
    test_profile()

    project_id = test_upload(args.video)

    if project_id:
        test_project_detail(project_id)
        test_status(project_id)

        if not args.skip_process:
            test_process(project_id)
            final_status = test_poll_status(project_id)

            if final_status == "completed":
                test_download(project_id)

    test_photo_enhancement()
    test_error_handling()

    if project_id and not args.skip_delete:
        test_list_and_delete(project_id)

    # Summary
    print(f"\n{BOLD}{'='*60}{RESET}")
    total = passed + failed
    if failed == 0:
        print(f"{BOLD}{GREEN}  All {total} tests passed! ✓{RESET}")
    else:
        print(f"{BOLD}  {GREEN}{passed} passed{RESET}, {RED}{failed} failed{RESET} (out of {total})")
    print(f"{BOLD}{'='*60}{RESET}\n")

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
