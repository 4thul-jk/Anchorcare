// Adapted safety role: use Muse's existing evidence-based routing, never auto-send on a keyword.
export {careAssessment,fallbackCare,careWording} from '../care-assistance';
// All external escalation remains behind MobileLink policy, explicit contact consent,
// or the user's enabled inactivity-check-in policy. This module never diagnoses.
