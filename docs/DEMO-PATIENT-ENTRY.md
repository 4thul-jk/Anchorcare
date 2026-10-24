# Key-free local demo patient entry — 24 October 2026

Athul's branch only; no schema or remote repository changes. Enable DEMO_PATIENT_AUTOLOGIN=true in the private local environment. The companion probes /status on entry, connects as the server-selected demo patient and hides the key form after success. No API credential is embedded in JavaScript, returned to the browser or placed in browser storage.

The exception applies only when NODE_ENV is not production, the patient is demo-person-001, the actual socket peer is loopback and the request hostname is localhost/127.0.0.1/IPv6 loopback. A nonempty invalid credential is never rescued by demo mode. Existing origin checks remain. Caregiver endpoints still require their own key and deny the demo patient. Other patients, remote/LAN clients and production continue to require authentication. It is intended for fictional demo records on a trusted local machine, not real patient access control. Any local process can use this patient demo access while enabled.

If the demo probe fails or the flag is off, the normal key form remains available. Use http://127.0.0.1:3000 and refresh to test. Caregiver tools still ask for a caregiver key. Turn DEMO_PATIENT_AUTOLOGIN=false and restart to restore mandatory patient keys locally.

Tests cover loopback/hostname/patient/production restrictions, caregiver denial, invalid-key rejection and the initial no-key patient screen.
