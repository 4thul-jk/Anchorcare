from datetime import datetime, timezone
from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field


class ActorRole(str, Enum):
    CAREGIVER = "caregiver"
    PATIENT = "patient"
    SYSTEM_AUTONOMOUS = "system_autonomous"


class EventType(str, Enum):
    MEAL_HYDRATION = "meal_hydration"
    MEDICATION_ROUTINE = "medication_routine"
    FAMILY_VISIT = "family_visit"
    DAILY_ACTIVITY = "daily_activity"
    MOOD_OBSERVATION = "mood_observation"
    SAFETY_CHECK = "safety_check"


class EpistemicStatus(str, Enum):
    OBSERVED = "observed"
    REPORTED = "reported"
    INFERRED = "inferred"


class EventStatus(str, Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    RETRACTED = "retracted"


class ActionType(str, Enum):
    FLAG_MEMORY_CONFLICT = "flag_memory_conflict"
    LOG_PATIENT_MOOD_REPORT = "log_patient_mood_report"
    SHOW_ORIENTATION_CARD = "show_orientation_card"
    ALERT_CAREGIVER_LOOP_DETECTED = "alert_caregiver_loop_detected"
    CREATE_REMINDER = "create_reminder"
    DRAFT_FAMILY_MESSAGE = "draft_family_message"
    MARK_ROUTINE_COMPLETED = "mark_routine_completed"
    CHANGE_MEDICATION_DOSE = "change_medication_dose"
    UNLOCK_DOOR = "unlock_door"
    CONTACT_EMERGENCY_SERVICES = "contact_emergency_services"


class ExecutionPolicy(str, Enum):
    AUTO_EXECUTE = "auto_execute"
    REQUIRE_APPROVAL = "require_approval"
    PROHIBITED = "prohibited"


class EventSource(BaseModel):
    type: Literal[
        "caregiver_observation",
        "caregiver_report",
        "family_call",
        "patient_self_report",
    ]
    author: str
    reference_id: str


class EventRecord(BaseModel):
    event_id: str
    person_id: str
    event_type: EventType
    occurred_at: datetime
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    statement: str = Field(min_length=3, max_length=1000)
    source: EventSource
    epistemic_status: EpistemicStatus
    confidence: float = Field(ge=0.0, le=1.0)
    status: EventStatus = EventStatus.ACTIVE
    supersedes: str | None = None
    superseded_by: str | None = None
    retraction_reason: str | None = None
    conflict_with_ids: list[str] = Field(default_factory=list)


class ProposedAction(BaseModel):
    action_type: ActionType
    summary: str = Field(description="Concise human-readable description of the proposed action")
    target_person_id: str
    parameters: dict[str, str] = Field(default_factory=dict)
    supporting_evidence_ids: list[str] = Field(
        default_factory=list,
        description="Prompt aliases (e.g. E1, E2) supporting this action",
    )


class CareResponse(BaseModel):
    answer: str
    evidence_ids: list[str] = Field(
        default_factory=list,
        description="Only prompt aliases provided in context (e.g. ['E1', 'E2'])",
    )
    epistemic_basis: Literal["observed", "reported", "inferred", "insufficient_evidence"]
    has_conflicting_evidence: bool = False
    uncertainty: str
    proposed_action: ProposedAction | None = None
