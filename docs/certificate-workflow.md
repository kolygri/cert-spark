# FieldCert EIC workflow

## Scope

FieldCert is structured around the current IET Electrical Installation Certificate model form for BS 7671:2018+A4:2026. It uses FieldCert branding and does not reproduce the IET logo or claim IET endorsement.

The IET permits electronic manipulation of its blank forms for an electrical contracting business, subject to its terms. Product and legal review is required before any generated certificate is presented as compliant.

Sources:

- [IET model forms and usage terms](https://electrical.theiet.org/bs-7671-18th-edition-wiring-regulations/model-forms/)
- [IET information on intended departures](https://electrical.theiet.org/wiring-matters/years/2025/106-july-2025/intended-departures-from-bs-7671/)

## Full EIC structure in the product

| Certificate section | FieldCert responsibility |
| --- | --- |
| A — Client details | Client identity, address and reference |
| B — Installation details | Installation address, description, extent and departures |
| C — Certification | Design, construction and inspection/testing responsibility |
| D — Next inspection | Recommended maximum interval and basis |
| E — Signatories | People, businesses and contact details associated with Section C |
| F — Supply and earthing | Supply characteristics, earthing and protective conductors |
| G — Installation particulars | Distribution equipment, protection and other supply sources |
| H — Inspections | Recorded inspection outcomes before issue |
| I — Existing installation comments | Relevant observations for additions or alterations |
| J — Schedules | Circuit details and recorded test results |

## User journey

1. The engineer creates an EIC, picks an existing client or speaks the customer and site details.
2. They describe the work in natural language while FieldCert proposes matched fields; nothing is written without review.
3. The engineer works through any missing details, inspection outcomes and circuit/test schedules.
4. FieldCert highlights mandatory gaps and lower-confidence voice extractions.
5. Accountable people review the statements attributed to them and sign only their own scope of responsibility.
6. FieldCert creates an immutable issued version with an audit event, PDF schedules and the recipient guidance.
7. The engineer downloads or emails the issued certificate; every delivery is recorded.

## Release guardrails

Before the production issue controls are enabled, FieldCert must have:

- a reviewed certificate-template and PDF output against the licensed/current model form;
- server-side user identity, company membership and audit logging;
- per-field validation, including required schedules and test-result rules;
- a clear signing policy, signer identity evidence and issued-document locking;
- an email delivery provider, PDF storage rules, retention policy and privacy notice;
- review by a suitably qualified electrical compliance professional.

Electronic signatures are a design choice that requires a documented policy and legal/compliance review for the specific issuing organisation and use case. FieldCert should never imply that a signature or completed field proves an installation is compliant; the accountable signatory does that.
