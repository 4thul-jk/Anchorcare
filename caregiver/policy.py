import hashlib
from pymongo.database import Database
from models import (
    ActionType,
    ActorRole,
    EventStatus,
    ExecutionPolicy,
    ProposedAction,
)

ACTION_POLICY_MAP: dict[ActionType, ExecutionPolicy] = {
    ActionType.FLAG_MEMORY_CONFLICT: ExecutionPolicy.AUTO_EXECUTE,
    ActionType.LOG_PATIENT_MOOD_REPORT: ExecutionPolicy.AUTO_EXECUTE,
    ActionType.SHOW_ORIENTATION_CARD: ExecutionPolicy.AUTO_EXECUTE,
    ActionType.ALERT_CAREGIVER_LOOP_DETECTED: ExecutionPolicy.AUTO_EXECUTE,
    ActionType.CREATE_REMINDER: ExecutionPolicy.REQUIRE_APPROVAL,
    ActionType.DRAFT_FAMILY_MESSAGE: ExecutionPolicy.REQUIRE_APPROVAL,
    ActionType.MARK_ROUTINE_COMPLETED: ExecutionPolicy.REQUIRE_APPROVAL,
    ActionType.CHANGE_MEDICATION_DOSE: ExecutionPolicy.PROHIBITED,
    ActionType.UNLOCK_DOOR: ExecutionPolicy.PROHIBITED,
    ActionType.CONTACT_EMERGENCY_SERVICES: ExecutionPolicy.PROHIBITED,
}


def evaluate_policy(action_type: ActionType) -> ExecutionPolicy:
    return ACTION_POLICY_MAP.get(action_type, ExecutionPolicy.PROHIBITED)


def compute_idempotency_key(proposal: ProposedAction) -> str:
    payload_str = (
        f"{proposal.action_type.value}:{proposal.target_person_id}:"
        f"{proposal.summary.strip().lower()}:{sorted(proposal.supporting_evidence_ids)}"
    )
    digest = hashlib.sha256(payload_str.encode("utf-8")).hexdigest()[:16]
    return f"idem_{proposal.action_type.value}_{digest}"


def verify_supporting_evidence_active(
    db: Database,
    supporting_evidence_ids: list[str],
) -> tuple[bool, list[str]]:
    if not supporting_evidence_ids:
        return True, []
    active_docs = list(
        db.events.find(
            {
                "event_id": {"$in": supporting_evidence_ids},
                "status": EventStatus.ACTIVE.value,
            },
            {"event_id": 1},
        )
    )
    active_ids = {d["event_id"] for d in active_docs}
    invalidated = [eid for eid in supporting_evidence_ids if eid not in active_ids]
    return len(invalidated) == 0, invalidated


def check_approval_permission(actor_role: ActorRole) -> None:
    if actor_role != ActorRole.CAREGIVER:
        raise PermissionError(
            "Only an authorized Caregiver can approve or execute REQUIRE_APPROVAL actions."
        )
