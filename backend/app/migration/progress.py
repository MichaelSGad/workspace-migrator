import json
import os
from pathlib import Path
from threading import Lock


class Progress:
    def __init__(self, path: str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self._data = {"done": {}, "pending": {}, "failed": {}, "label_map": {}, "stats": {}}
        if self.path.exists():
            try:
                loaded = json.loads(self.path.read_text())
                self._data = loaded
                for key in ("done", "pending", "failed", "label_map", "stats"):
                    self._data.setdefault(key, {})
            except json.JSONDecodeError:
                pass

    def is_done(self, item_id: str) -> bool:
        return item_id in self._data["done"]

    def is_pending(self, item_id: str) -> bool:
        return item_id in self._data["pending"]

    def pending_items(self) -> dict:
        return dict(self._data["pending"])

    # Called before writing to target — if we crash here, item is retried on resume
    def mark_pending(self, item_id: str, meta: dict | None = None):
        with self._lock:
            self._data["pending"][item_id] = meta or {}
            self._flush()

    def mark_done(self, item_id: str, meta: dict | None = None):
        with self._lock:
            self._data["done"][item_id] = meta or True
            self._data["pending"].pop(item_id, None)
            self._data["failed"].pop(item_id, None)
            self._flush()

    def mark_failed(self, item_id: str, error: str):
        with self._lock:
            self._data["failed"][item_id] = error
            self._data["pending"].pop(item_id, None)
            self._flush()

    def set_label_map(self, mapping: dict):
        with self._lock:
            self._data["label_map"] = mapping
            self._flush()

    def label_map(self) -> dict:
        return self._data["label_map"]

    def update_stats(self, **kwargs):
        with self._lock:
            self._data["stats"].update(kwargs)
            self._flush()

    def done_count(self) -> int:
        return len(self._data["done"])

    def failed_count(self) -> int:
        return len(self._data["failed"])

    def pending_count(self) -> int:
        return len(self._data["pending"])

    def failed_items(self) -> dict:
        return dict(self._data["failed"])

    def _flush(self):
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._data, indent=2))
        os.replace(tmp, self.path)
