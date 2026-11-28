#!/usr/bin/env python3
"""ORACLE Creative Studio local image engine.
Binds only to 127.0.0.1 and accepts requests only from Chromium extension origins.
"""
from __future__ import annotations
import json, os, re, threading, uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("DO_NOT_TRACK", "1")
HOST, PORT = "127.0.0.1", 8765
MODEL_ID = "OpenVINO/stable-diffusion-v1-5-int8-ov"
CLIENT_HEADER, CLIENT_VALUE = "X-ORACLE-Client", "oracle-creative-studio-v1"
EXTENSION_ORIGIN = re.compile(r"^(?:chrome|edge)-extension://[a-p]{32}$")
LOCAL_ROOT = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "ORACLE" / "CreativeStudio"
MODEL_DIR, GALLERY_DIR = LOCAL_ROOT / "models" / "stable-diffusion-v1-5-int8-ov", LOCAL_ROOT / "gallery"
GALLERY_DIR.mkdir(parents=True, exist_ok=True)

_state_lock = threading.RLock()
_setup_lock = threading.Lock()
_generation_lock = threading.Lock()
_pipeline = None
_state = {"stage":"not-installed","message":"Install the ORACLE Creative Studio companion, then start the local engine.","model_ready":False,"device":None,"available_devices":[],"gpu_available":False,"job":None}

def update_state(**values):
    with _state_lock:
        _state.update(values)

def status_snapshot():
    with _state_lock:
        snapshot = dict(_state)
        if snapshot.get("job"):
            snapshot["job"] = dict(snapshot["job"])
        snapshot["service"] = "ORACLE Creative Studio"
        snapshot["service_version"] = "1.0.0"
        snapshot["model_id"] = MODEL_ID
        snapshot["model_downloaded"] = (MODEL_DIR / "model_index.json").exists()
        snapshot["gallery_count"] = len(list(GALLERY_DIR.glob("*.png")))
        return snapshot

def setup_worker():
    global _pipeline
    if not _setup_lock.acquire(blocking=False):
        return
    try:
        update_state(stage="downloading", message="Downloading the OpenVINO INT8 image model from Hugging Face. This is a one-time download; generation stays on this computer.")
        from huggingface_hub import snapshot_download
        MODEL_DIR.parent.mkdir(parents=True, exist_ok=True)
        model_path = Path(snapshot_download(repo_id=MODEL_ID, local_dir=str(MODEL_DIR)))
        if not (model_path / "model_index.json").exists():
            raise RuntimeError("The downloaded model is missing model_index.json. The model download may be incomplete.")
        update_state(stage="loading", message="Model downloaded. Checking Intel devices and loading the image pipeline…")
        import openvino as ov
        import openvino_genai as ov_genai
        devices = list(ov.Core().available_devices)
        gpu = next((name for name in devices if name.startswith("GPU")), None)
        update_state(available_devices=devices, gpu_available=bool(gpu))
        gpu_error = None
        if gpu:
            try:
                _pipeline = ov_genai.Text2ImagePipeline(str(model_path), gpu)
                update_state(device=gpu)
            except Exception as error:
                gpu_error = error
                _pipeline = None
        if _pipeline is None:
            try:
                _pipeline = ov_genai.Text2ImagePipeline(str(model_path), "CPU")
                update_state(device="CPU")
            except Exception as error:
                detail = str(error)
                if gpu_error:
                    detail = "Intel GPU initialisation failed (" + str(gpu_error) + "); CPU fallback failed (" + detail + ")."
                raise RuntimeError(detail) from error
        update_state(stage="ready", model_ready=True, message="Image generation is ready on " + str(status_snapshot().get("device") or "CPU") + ". Your prompts and images remain on this device.")
    except Exception as error:
        _pipeline = None
        update_state(stage="error", model_ready=False, message="Image engine setup failed: " + str(error)[:900])
    finally:
        _setup_lock.release()

def generate_worker(job_id, prompt, negative_prompt, steps):
    global _pipeline
    try:
        from PIL import Image

        kwargs = {
            "width": 512,
            "height": 512,
            "num_inference_steps": steps,
            "num_images_per_prompt": 1,
        }
        if negative_prompt.strip():
            kwargs["negative_prompt"] = negative_prompt.strip()

        update_state(job={
            "id": job_id,
            "state": "running",
            "progress": None,
            "message": "OpenVINO is generating your image locally. This model does not expose per-step progress through the stable Python generate API.",
        })

        try:
            result = _pipeline.generate(prompt, **kwargs)
        except Exception as gpu_error:
            active_device = str(status_snapshot().get("device") or "CPU")
            if not active_device.upper().startswith("GPU"):
                raise
            update_state(job={
                "id": job_id,
                "state": "running",
                "progress": None,
                "message": "Intel GPU generation failed. Reinitialising the pipeline on CPU and retrying once…",
            })
            import openvino_genai as ov_genai
            _pipeline = ov_genai.Text2ImagePipeline(str(MODEL_DIR), "CPU")
            update_state(device="CPU", job={
                "id": job_id,
                "state": "running",
                "progress": None,
                "message": "Retrying generation on CPU after an Intel GPU error: " + str(gpu_error)[:300],
            })
            result = _pipeline.generate(prompt, **kwargs)

        image = Image.fromarray(result.data[0])
        image_id = uuid.uuid4().hex
        image_path = GALLERY_DIR / (image_id + ".png")
        image.save(image_path, format="PNG", optimize=True)
        metadata = {
            "id": image_id,
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "width": 512,
            "height": 512,
            "steps": steps,
            "device": status_snapshot().get("device") or "unknown",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "filename": image_path.name,
        }
        (GALLERY_DIR / (image_id + ".json")).write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        update_state(job={
            "id": job_id,
            "state": "complete",
            "progress": 100,
            "message": "Image generated and saved to your local gallery.",
            "image_id": image_id,
        })
    except Exception as error:
        update_state(job={
            "id": job_id,
            "state": "error",
            "progress": 0,
            "message": "Generation failed: " + str(error)[:900],
        })
    finally:
        _generation_lock.release()

class Handler(BaseHTTPRequestHandler):
    server_version = "ORACLE-Creative-Engine/1.0"
    def log_message(self, fmt, *args):
        print("[ORACLE Creative Studio] " + (fmt % args), flush=True)
    def _origin(self):
        origin = self.headers.get("Origin", "")
        if not EXTENSION_ORIGIN.fullmatch(origin):
            return None
        if self.headers.get("Host", "") not in (f"{HOST}:{PORT}", f"localhost:{PORT}"):
            return None
        return origin
    def _cors(self, origin):
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-ORACLE-Client")
            self.send_header("Cache-Control", "no-store")
    def _json(self, code, data, origin):
        body = json.dumps(data,ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Content-Length",str(len(body)))
        self._cors(origin)
        self.end_headers()
        self.wfile.write(body)
    def _blocked(self):
        origin = self._origin()
        if not origin or self.headers.get(CLIENT_HEADER) != CLIENT_VALUE:
            self._json(403,{"ok":False,"error":"Request rejected. Only the installed ORACLE browser extension can access this local service."},origin)
            return None
        return origin
    def do_OPTIONS(self):
        origin = self._origin()
        if not origin:
            self.send_error(403)
            return
        self.send_response(204)
        self._cors(origin)
        self.send_header("Content-Length","0")
        self.end_headers()
    def do_GET(self):
        origin = self._blocked()
        if not origin: return
        parsed = urlsplit(self.path)
        query = parse_qs(parsed.query)
        if parsed.path == "/api/health":
            try:
                import openvino as ov
                import openvino_genai as ov_genai
                devices = list(ov.Core().available_devices)
                self._json(200, {
                    "ok": True,
                    "runtime_ready": True,
                    "openvino_version": getattr(ov, "__version__", "available"),
                    "genai_available": ov_genai is not None,
                    "devices": devices,
                    "gpu_available": any(str(device).upper().startswith("GPU") for device in devices),
                }, origin)
            except Exception as error:
                self._json(503, {
                    "ok": False,
                    "runtime_ready": False,
                    "error": "The bundled OpenVINO runtime could not initialise: " + str(error)[:900],
                }, origin)
            return
        if parsed.path == "/api/status":
            self._json(200,{"ok":True,**status_snapshot()},origin)
            return
        if parsed.path == "/api/gallery":
            items = []
            for metadata_path in sorted(GALLERY_DIR.glob("*.json"),key=lambda p:p.stat().st_mtime,reverse=True)[:12]:
                try:
                    item = json.loads(metadata_path.read_text(encoding="utf-8"))
                    if (GALLERY_DIR / item.get("filename","")).is_file(): items.append(item)
                except Exception: pass
            self._json(200,{"ok":True,"items":items},origin)
            return
        if parsed.path == "/api/image":
            image_id = (query.get("id") or [""])[0]
            if not re.fullmatch(r"[a-f0-9]{32}",image_id):
                self._json(400,{"ok":False,"error":"Invalid image identifier."},origin); return
            path = GALLERY_DIR / (image_id + ".png")
            if not path.is_file():
                self._json(404,{"ok":False,"error":"Image not found in the local gallery."},origin); return
            body = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type","image/png")
            self.send_header("Content-Length",str(len(body)))
            self._cors(origin)
            self.end_headers()
            self.wfile.write(body)
            return
        self._json(404,{"ok":False,"error":"Unknown endpoint."},origin)
    def do_POST(self):
        origin = self._blocked()
        if not origin: return
        length = int(self.headers.get("Content-Length","0") or 0)
        if length <= 0 or length > 12000:
            self._json(413,{"ok":False,"error":"Request body is empty or too large."},origin); return
        try: payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self._json(400,{"ok":False,"error":"Invalid JSON request."},origin); return
        if self.path == "/api/setup":
            snapshot = status_snapshot()
            if snapshot["model_ready"]:
                self._json(200,{"ok":True,"message":snapshot["message"]},origin); return
            if snapshot["stage"] in ("downloading","loading"):
                self._json(202,{"ok":True,"message":snapshot["message"]},origin); return
            threading.Thread(target=setup_worker,name="oracle-image-setup",daemon=True).start()
            self._json(202,{"ok":True,"message":"Local image engine setup started."},origin); return
        if self.path == "/api/generate":
            prompt = str(payload.get("prompt","")).strip()
            negative = str(payload.get("negative_prompt","")).strip()[:800]
            steps = payload.get("steps",20)
            if not prompt or len(prompt) > 1600:
                self._json(400,{"ok":False,"error":"Enter an image prompt between 1 and 1,600 characters."},origin); return
            if type(steps) is not int or steps not in (10,15,20,25,30):
                self._json(400,{"ok":False,"error":"Choose 10, 15, 20, 25 or 30 generation steps."},origin); return
            snapshot = status_snapshot()
            if not snapshot["model_ready"] or _pipeline is None:
                self._json(409,{"ok":False,"error":"Prepare the local image engine before generating."},origin); return
            if not _generation_lock.acquire(blocking=False):
                self._json(409,{"ok":False,"error":"An image is already being generated. Please wait for it to finish."},origin); return
            job_id = uuid.uuid4().hex
            update_state(job={"id":job_id,"state":"running","progress":0,"message":"Starting image generation…"})
            threading.Thread(target=generate_worker,args=(job_id,prompt,negative,steps),name="oracle-image-generation",daemon=True).start()
            self._json(202,{"ok":True,"job_id":job_id},origin); return
        self._json(404,{"ok":False,"error":"Unknown endpoint."},origin)

def main():
    LOCAL_ROOT.mkdir(parents=True,exist_ok=True)
    server = ThreadingHTTPServer((HOST,PORT),Handler)
    server.daemon_threads = True
    update_state(stage="idle", message="Local service is running. Prepare the image model from ORACLE Creative Studio when you are ready.")
    print("ORACLE Creative Studio local engine is listening on http://" + HOST + ":" + str(PORT),flush=True)
    print("Model and gallery data: " + str(LOCAL_ROOT),flush=True)
    print("Keep this window open while using Creative Studio. Press Ctrl+C to stop.",flush=True)
    try: server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt: print("\nStopping ORACLE Creative Studio.",flush=True)
    finally: server.server_close()

if __name__ == "__main__":
    main()
