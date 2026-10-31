from dataclasses import dataclass, field
STAGES = ["research","script","visual_direction","artwork","animation","audio","render","quality_control","human_approval"]
@dataclass
class Check:
    name: str
    passed: bool
    message: str
@dataclass
class StageResult:
    stage: str
    status: str
    message: str
    outputs: list[str] = field(default_factory=list)
