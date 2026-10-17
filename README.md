# BankFlow AI

An accessible banking-form demonstration for one connected customer-to-employee workflow. The current MVP supports a savings-account application, private image documents, browser OCR, review notes, correction requests, and same-record resubmission.

This is a prototype. It does not connect to a bank, perform official KYC, verify identity, or open an account. Use fictional people and fictional documents only.

## Architecture

- React + TypeScript + Vite for the responsive web application.
- Supabase Auth for live customer and employee sign-in; browser-only demo accounts when Supabase is not configured.
- Supabase Postgres with Row Level Security for shared applications, document metadata, and review history.
- Private Supabase Storage bucket `application-documents` for uploaded images.
- Tesseract.js runs OCR on the selected image in the browser. A temporary orientation-aware, resized grayscale/contrast copy is used for OCR; the original image is retained. Mapping is deterministic and only fills values found in actual OCR text.
- In development, OCR diagnostics include selected models, raw recognized text, extracted fields, and form-state mapping in the local console. These diagnostics are guarded by the development build flag and are omitted from production builds.
- The customer flow is localized in English, Kannada, Hindi, and Tamil. Spoken interface locales are `en-IN`, `kn-IN`, `hi-IN`, and `ta-IN`; speech playback uses a matching browser voice when installed, and typed answers remain available.
- Tesseract uses the printed document language (`eng`, `kan`, `hin`, or `tam`) independently from the interface language. English can be added for mixed-language documents. OCR results stay in the browser until the customer submits the form; the raw text and fields remain editable and require customer review.

Database tables use the `bankflow_` prefix so the schema avoids collisions with unrelated public tables in an existing Supabase project. The setup is in [the initial Supabase migration](supabase/migrations/20261017133530_bankflow_initial_schema.sql). Do not apply it to a cloud project until the project and target schema have been reviewed.

## Requirements

- Node.js 22 or newer and npm.
- A Supabase project you control. The project URL and publishable key are entered in a local environment file.
- For local Supabase emulation: Docker Desktop and the Supabase CLI.
- A modern browser. Speech recognition support depends on the browser and operating system.

## Run locally

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set these values in `.env.local`:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Use only the Supabase publishable key in the browser app. Never put a service-role or secret key in `VITE_*`, the source tree, or a browser bundle. Restart Vite after changing environment variables. With no Supabase URL and publishable key, the app automatically enters **LOCAL DEMO MODE** so the customer-to-employee workflow can be exercised without cloud resources. You can also force local mode with `VITE_BANKFLOW_LOCAL_DEMO=true` or by opening the app with `?mode=local`.

Local Demo Mode uses fictional browser-only accounts and stores application metadata in this browser's local storage and image files in IndexedDB. It is not secure authentication, private multi-user storage, or Supabase persistence. Use fictional names and documents only. No local demo records are sent to Supabase.

The local reviewer account is `reviewer@bankflow.local` with password `ReviewDemo2026!`. Customer accounts can be registered in the customer portal. To test the full local loop, sign up a fictional customer, submit an application with two fictional images, sign out, then sign in to the employee portal with the reviewer account.

## Supabase setup

1. Create or select a Supabase project and register the local URL (`http://localhost:5173`) in Authentication URL settings.
2. Keep email confirmation enabled if desired; after registration, confirm the email before signing in when the project requires it.
3. Review `supabase/migrations/20261017133530_bankflow_initial_schema.sql`. It creates the BankFlow tables, RLS policies, status guard, review-history trigger, private bucket, and Storage policies. It does not delete existing tables or rows. If the bucket already exists, the setup stops when it detects public access or different limits.
4. For local Supabase, run `npx supabase start` and then `npx supabase migration up --local`. For a linked cloud project, `npx supabase db push --linked` applies pending migrations; this changes the remote schema and should be done only after project review and explicit approval. Confirm RLS and Storage policies before using customer data.
5. Copy the project URL and publishable key into `.env.local` and restart the app. Remove `?mode=local` and set `VITE_BANKFLOW_LOCAL_DEMO` to anything other than `true` to use Supabase.

The available connected Supabase project was inactive during this implementation review. No project was resumed, no migration was applied, and no cloud storage bucket or database objects were changed.

### Optional IBM watsonx form guidance

The app includes a signed-in Supabase Edge Function for generic form guidance. It accepts only a fixed topic code and one of the four interface-language codes. It does not accept arbitrary customer text and does not send names, dates of birth, phone numbers, addresses, document numbers, images, OCR output, or the caller's Supabase access token to IBM. The function has a per-instance limit of six requests per user per minute and an eight-second timeout for each upstream request. Because Edge Function instances can restart or scale independently, this in-memory limit is a best-effort guard, not a durable account-wide quota.

The IBM path is **prepared but inactive until configured and deployed**. No IBM API credentials or model availability were verified for this project, and no IBM request has been made. Before enabling it, confirm account access, regional endpoint, current model availability in your project, and any billing or usage terms. Then add these server-side Supabase Function secrets using the Supabase dashboard or your approved secret-management workflow:

- `WATSONX_API_KEY`
- `WATSONX_PROJECT_ID`
- `WATSONX_URL` (the HTTPS region endpoint shown in IBM Developer access)
- `WATSONX_MODEL_ID` (a text-generation model enabled for that project)
- `BANKFLOW_CORS_ORIGINS` (comma-separated exact web-app origins; local Vite origins are allowed by default)

The function also uses the configured Supabase function environment values `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`). After reviewing the function and setting secrets, an authorized project owner can deploy it with `npx supabase functions deploy form-guidance`. Deployment is a cloud change and is intentionally not performed as part of this code-only work. Until it is deployed and returns a successful IBM inference response, the customer flow displays localized on-screen fallback guidance.

IBM Watson Text to Speech was not selected: IBM's currently published voice list includes English and several other languages, but does not list Kannada, Hindi, or Tamil. The app therefore keeps browser speech synthesis and reports when the selected language has no installed browser voice. See [IBM's current TTS language and voice list](https://cloud.ibm.com/docs/text-to-speech?topic=text-to-speech-voices). The watsonx code follows IBM's IAM bearer-token flow and versioned text-generation API; the model identifier must be selected from the account's currently available models. See [IBM's watsonx API guide](https://www.ibm.com/docs/en/watsonx/saas?topic=solutions-rest-api) and [programmatic credentials guide](https://www.ibm.com/docs/en/watsonx/saas?topic=resources-credentials-programmatic-access).

### Provision an employee account securely

1. Create the employee's Auth account through the Supabase dashboard or a trusted administrator workflow. The application has no public employee registration form.
2. After the account exists, copy its Auth user UUID and run this as a trusted project administrator in the SQL Editor:

```sql
begin;
insert into public.bankflow_employee_roles (user_id)
values ('EMPLOYEE_AUTH_USER_UUID');
update public.bankflow_profiles
set role = 'employee'
where id = 'EMPLOYEE_AUTH_USER_UUID';
commit;
```

The browser role lookup can read only the signed-in user's role row. Customers have no insert, update, or delete grants on `bankflow_employee_roles`, and the RLS policies use that table rather than user-editable Auth metadata.

## Data and access model

- `bankflow_profiles`: profile display name and role label. A trusted Auth trigger creates new profiles as customers.
- `bankflow_employee_roles`: administrator-managed employee allowlist; clients can read only their own row.
- `bankflow_applications`: one shared application record with customer details, status, correction message, and timestamps.
- `bankflow_documents`: private storage path, raw OCR text, parsed fields, separate customer-corrected fields, and current/replaced versions.
- `bankflow_review_history`: append-only status transitions and employee notes.
- `application-documents`: private bucket, JPEG/PNG/WebP only, maximum 10 MB. File previews are fetched through authenticated Storage access and displayed from temporary browser object URLs.

RLS restricts customers to their own records, limits employees to submitted records, and lets authorized employees review the shared application. A database trigger enforces lifecycle transitions and writes status history atomically. Document replacement adds a new version and preserves the earlier OCR text and storage record.

## Supported workflow

Form dates are stored as date-only ISO values (`YYYY-MM-DD`). Full or abbreviated English month names are accepted. Numeric dates are interpreted only when one component is greater than 12 and identifies the day position; ambiguous values such as `02/03/2007` must be entered with a month name. This avoids silently choosing between day-first and month-first formats.

1. Customer creates an account, signs in, and starts a savings-account application. In local mode, the account is confined to this browser; in live mode, Supabase Auth is used.
2. They choose English, Kannada, Hindi, or Tamil for the interface and answer one guided question at a time. They can repeat prompts with an installed matching speech voice or dictate with the browser's speech service where supported. Dictated words are previewed and must be accepted before they update a field.
3. They preview an identity image and an address-proof image, choose the main language printed on each document, and can add English for mixed-language text. Tesseract.js runs on the actual image in the browser. The app shows raw OCR separately, extracts only labeled values, and leaves uncertain or missing fields for manual review.
4. The review screen compares proposed document values with the banking form. The customer chooses which values to apply; the form is never silently overwritten. After confirming, the application and both document records are saved to the active mode: Supabase in live mode, or browser storage in Local Demo Mode.
5. An authorized employee opens the same record, views the private document previews and OCR results, moves it under review, adds a note, requests a correction, or completes/rejects the demo review.
6. The customer sees the saved correction message, edits the same application, and resubmits it. The review history and replaced document versions remain attached to that application.

Other categories shown on the landing page are clearly marked as planned. They do not have working forms in this MVP. PDF OCR is not included.

## Checks

```powershell
npm run typecheck
npm test
npm run test:ocr
npm run build
```

Unit tests cover OCR field mapping and worker cleanup, supported language/locale selection, speech voice matching and recognition errors, stale request handling, upload and camera error handling, local IndexedDB persistence, access boundaries, status transitions, and same-record resubmission. `src/lib/fields.image.test.ts` runs Tesseract.js on both complete English examples and a missing-address image, checks all five expected values and form-state mapping, and confirms the absent address stays empty and reviewable; [the OCR test report](docs/sample-documents/ocr-test-results.md) records actual recognized text and the original/preprocessed comparison. `npm run test:ocr` runs Tesseract.js on the English, Hindi, Kannada, and Tamil fictional fixtures. The Indic fixtures check script output and dates; Kannada/Tamil name and ID recognition is imperfect, and Hindi's exact mixed-field result applies only to the supplied synthetic fixture. These synthetic images do not establish accuracy on customer documents. Local records can be exercised with the browser steps above. Live Auth, database, Storage, RLS, camera, and browser speech workflows were not verified here.

### Manual end-to-end review

- Change the interface language to English, Kannada, Hindi, and Tamil. Check that prompts, validation, status, voice controls, OCR controls, and the customer portal update with it.
- For each document image, set its printed language independently of the spoken interface language. Verify English-only and English-plus-selected-language model choices; compare the raw OCR with the image and correct uncertain values manually.
- Try prompt playback and dictation for each supported locale. If the browser has no matching speech voice or recognition support, confirm the status message appears and that typed answers still work. Confirm dictation text must be accepted before it changes a field.
- Register a fictional customer and submit a savings-account form with [fictional identity](docs/sample-documents/fictional-identity.png) and [fictional address-proof](docs/sample-documents/fictional-address-proof.png) images.
- Preview each image, choose the Read this image with Tesseract.js action, compare the recognized raw text to the supplied picture, and verify extracted values are editable and missing values remain blank.
- Confirm each image shows its own raw OCR output and that missing values remain marked for review.
- Sign in with a separately provisioned employee account and confirm the same application and private document previews load.
- Request a correction with a clear message, refresh the customer portal, and confirm the message appears.
- Correct a field or replace a document, resubmit, and confirm the reference number is unchanged and history is preserved.
- Mark the application under review and complete the demo review. Refresh the customer portal and verify the status.
- Test a customer account against a different customer's application and Storage path; RLS should deny access.
- Try a PDF, a file over 10 MB, and an unreadable image. Confirm errors appear and no OCR value is fabricated.

## Known limits

- Local Demo Mode stores metadata in local storage and document blobs in IndexedDB on this browser profile. Other profiles and devices cannot access those records; clearing site storage deletes them. This mode has no server-enforced authorization.
- The cloud backend is not configured in this workspace yet. The currently connected Supabase project is inactive and its schema could not be inspected while inactive. No cloud resources have been changed.
- Tesseract.js downloads its open-source worker and selected language data in the browser. The image itself is processed in the browser and is not sent to an OCR/AI service. Initial processing can take time, requires access to the static worker/model files, and accuracy varies by document quality; the included Kannada and Tamil examples misread names and document numbers.
- Browser speech synthesis voices and speech recognition support vary by browser and operating system. A matching voice may be absent, and browser recognition may process audio through its own service. BankFlow reports unavailable features, keeps dictation optional, and always allows typed answers.
- This demo is not production banking software. It does not include official verification, fraud checks, bank integrations, additional product forms, or PDF processing.
- Supabase free-tier quotas and project inactivity behavior can change; review the current plan and usage in the Supabase dashboard.
