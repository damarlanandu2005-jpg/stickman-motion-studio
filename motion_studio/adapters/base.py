from abc import ABC,abstractmethod
from pathlib import Path
from typing import Any
class EngineAdapter(ABC):
    """Contract for replaceable local or remote generation engines."""
    name: str
    @abstractmethod
    def healthcheck(self) -> dict[str,Any]:
        """Return availability/version without submitting a job."""
    @abstractmethod
    def submit(self,job: dict[str,Any],output_dir: Path) -> dict[str,Any]:
        """Submit a job and return a traceable result manifest."""
