from typing import Callable


ProgressCallback = Callable[[int, int, int, int, str], None]


class BaseMigrator:
    """
    Basisklasse for alle migratorer.
    on_progress(total, migrated, skipped, failed, log_line) kaldes løbende.
    """

    def __init__(
        self,
        source_user: str,
        target_user: str,
        source_sa: str,
        target_sa: str,
        progress_dir: str,
        on_progress: ProgressCallback | None = None,
    ):
        self.source_user = source_user
        self.target_user = target_user
        self.source_sa = source_sa
        self.target_sa = target_sa
        self.progress_dir = progress_dir
        self._on_progress = on_progress or (lambda *_: None)

    def _report(self, total: int, migrated: int, skipped: int, failed: int, log_line: str = ""):
        self._on_progress(total, migrated, skipped, failed, log_line)

    def run(self) -> dict:
        raise NotImplementedError
