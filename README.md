# FieldCert UI prototype

A mobile-first, voice-led prototype for completing UK electrical installation certificates on site.

## Product flow

1. Start or resume a certificate from the dashboard.
2. Work through the familiar A–J certificate sections.
3. Tap the persistent voice action from anywhere in the app.
4. Describe the work naturally, without naming form fields.
5. Review the values FieldCert matched, including confidence warnings.
6. Apply the confirmed values, resolve missing details, sign and export.

The current demo implements the full A–J certificate journey and a simulated voice-to-fields review flow. It uses the section structure of the [IET BS 7671:2018+A4:2026 model Electrical Installation Certificate](https://electrical.theiet.org/bs-7671-18th-edition-wiring-regulations/model-forms/) as its reference. It does not reproduce the IET logo. Read the [certificate workflow](docs/certificate-workflow.md) for the release guardrails and section mapping.

## Run locally

```bash
npm install
npm run dev
```

Production and code-quality checks:

```bash
npm run build
npm run lint
```

## Current prototype scope

- Responsive desktop, tablet and phone layouts
- Dashboard, certificate list and in-progress certificate views
- A–J certificate navigation and field groups aligned to the latest model form
- Contextual and persistent voice entry points
- Listening, transcript review, confidence and apply states
- Editable certificate details, responsibilities, supply/earthing and circuit schedule controls
- Clearly marked pending signing, emailing and PDF issue controls

Speech recognition, model-based field mapping, persistence, authentication, signatures and PDF export are intentionally left for the backend/product integration phase.
