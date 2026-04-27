import threading
from typing import Callable

ProgressCallback = Callable[[int, int, int, int, str], None]


class BaseMigrator:
    def __init__(
        self,
        source_user: str,
        target_user: str,
        source_sa: str,
        target_sa: str,
        progress_dir: str,
        on_progress: ProgressCallback | None = None,
        stop_event: threading.Event | None = None,
    ):
        self.source_user = source_user
        self.target_user = target_user
        self.source_sa = source_sa
        self.target_sa = target_sa
        self.progress_dir = progress_dir
        self._on_progress = on_progress or (lambda *_: None)
        self._stop_event = stop_event or threading.Event()

    def _report(self, total: int, migrated: int, skipped: int, failed: int, log_line: str = ""):
        self._on_progress(total, migrated, skipped, failed, log_line)

    def _should_stop(self) -> bool:
        return self._stop_event.is_set()

    def run(self) -> dict:
        raise NotImplementedError

    def verify(self) -> dict:
        raise NotImplementedError
