# ASD STIG and NIST SP 800-53 Rev. 5 review of Open MCT untrusted-input boundaries

This document records a source-code review of Open MCT's untrusted-input and
data boundaries against the DISA Application Security and Development (ASD)
STIG and NIST SP 800-53 Rev. 5. It lists findings, an explicit outcome for
every boundary, what was remediated in the accompanying change set, and the
deployment evidence that cannot be determined from source code alone.

This is a code review, not a certification, accreditation, or attestation of
compliance. Outcomes marked `satisfied` mean the reviewed source implements the
control's intent as far as it can be determined from the code; they are inputs
to an assessor's determination, not a determination themselves.

## Scope and method

- Repository state reviewed: `master` at `a4aae41af`, with remediations on
  branch `devin/1788814351-asd-stig-nist-review-remediation`.
- Method: repository-wide searches for parsers, HTML/DOM sinks (`v-html`,
  `innerHTML`), URL sinks, persistence providers, user/role providers,
  expression evaluators and operator-facing error paths, followed by manual
  reading of each boundary.
- ASD STIG source: DISA Application Security and Development STIG, Version 6
  Release 4 (V6R4), dated 2025-09-09, as published at
  <https://www.stigviewer.com/stigs/application_security_and_development>
  (34 CAT I, 230 CAT II, 22 CAT III rules). Rule IDs and titles below were
  read from the per-rule pages of that publication.
- NIST SP 800-53 Rev. 5 control identifiers are the ones named in the ASD STIG
  rule text and in the organization's control vocabulary.
- Line numbers refer to the remediated branch.

### Outcome vocabulary

| Outcome | Meaning |
| --- | --- |
| `satisfied` | The reviewed source implements the control's intent at this boundary. |
| `not-satisfied` | A weakness was found in source. All such rows in this document are remediated in the accompanying change set unless stated otherwise. |
| `needs-input` | Cannot be determined from source; requires deployment evidence from the ISSM / assessor / system owner. |
| `not-applicable` | The control does not apply to this boundary as implemented. |

### Relationship to open security changes #10-#13

The following findings were already addressed by open pull requests on this
fork and are intentionally **not** duplicated here:

| PR | Boundary | Finding covered there |
| --- | --- | --- |
| #10 | Comps plugin SharedWorker | Hardening of `mathjs` expression evaluation in the Comps worker. |
| #11 | Web Page plugin | `iframe` sandboxing and URL allowlist for embedded web pages. |
| #12 | Build / supply chain | npm registry signature verification. |
| #13 | Export as CSV | Formula-injection protection in CSV export. |

This review therefore excludes `src/plugins/comps`, `src/plugins/webPage` and
the CSV exporter; the Export-as-JSON row below covers only the JSON path.

## Trust-boundary summary

Every boundary named in the review request has an explicit outcome.

| # | Boundary | Primary location | Outcome | Remediated here |
| --- | --- | --- | --- | --- |
| B1 | Import from JSON | `src/plugins/importFromJSONAction/` | `not-satisfied` -> remediated | Yes (F-01, F-02, F-03, F-13) |
| B2 | Export as JSON | `src/plugins/exportAsJSONAction/` | `not-satisfied` -> remediated | Yes (F-04, F-13) |
| B3 | Notebook entry text (Markdown) | `src/plugins/notebook/components/NotebookEntry.vue` | `not-satisfied` -> remediated | Yes (F-05, F-06, F-13) |
| B4 | Notebook embeds / snapshot images | `src/plugins/notebook/components/NotebookEmbed.vue`, `utils/notebook-image.js` | `satisfied` | No change required |
| B5 | Hyperlink plugin | `src/plugins/hyperlink/HyperlinkLayout.vue` | `satisfied` | No change required |
| B6 | URL indicator plugin | `src/plugins/URLIndicatorPlugin/URLIndicator.js` | `needs-input` | No (F-14) |
| B7 | CouchDB persistence | `src/plugins/persistence/couch/` | `not-satisfied` (SI-11) -> remediated; `needs-input` (SC-8, IA-2, SC-28) | Yes (F-07); deployment items open (F-15, F-16, F-18) |
| B8 | LocalStorage persistence | `src/plugins/localStorage/`, `src/api/user/StoragePersistence.js` | `not-satisfied` (SI-11) -> remediated; `needs-input` (SC-28) | Yes (F-08); deployment item open (F-18) |
| B9 | Example user / operator status / role model | `example/exampleUser/`, `src/plugins/userIndicator/`, `src/plugins/operatorStatus/`, `src/api/user/` | `needs-input` (IA-2, AC-3, session); `not-satisfied` (AU-2/AU-3) -> remediated | Yes (F-13 role-change audit); deployment items open (F-17, F-19) |
| B10 | Condition Sets (user-authored criteria) | `src/plugins/condition/utils/operations.js` | `satisfied` | No change required |
| B11 | Summary Widgets (user-authored rules) | `src/plugins/summaryWidget/src/ConditionEvaluator.js` | `satisfied` | No change required |
| B12 | `v-html` sinks | `NotebookEntry.vue`, `TextHighlight.vue`, `AboutDialog.vue` | `not-satisfied` -> remediated (two sinks); `satisfied` (one sink, config-only) | Yes (F-05, F-09) |
| B13 | `innerHTML` sinks | 15 assignment sites (listed under F-10) | `satisfied` | No change required |
| B14 | Fault management acknowledge / shelve | `src/api/faultmanagement/FaultManagementAPI.js` | `not-satisfied` (AU-2/AU-3) -> remediated | Yes (F-13) |
| B15 | Object create / save operator-facing errors | `src/plugins/formActions/CreateAction.js` | `not-satisfied` -> remediated | Yes (F-11) |
| B16 | Deployment: TLS, authentication, session, storage encryption, security headers, centralized logging | Not in source | `needs-input` | No (F-15 to F-20) |

## Findings

Severity is the ASD STIG category of the cited rule. "Org ref" is the
organization control-vocabulary identifier (STIG V-2206xx <-> NIST mapping)
used across this organization's repositories.

| ID | File:line | Description | CWE | ASD STIG V6R4 rule | NIST 800-53 r5 | Severity | Org ref | Outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-01 | `src/plugins/importFromJSONAction/ImportFromJSONAction.js:87` (before: `JSON.parse` of file contents with no schema check) | Imported JSON was parsed and persisted with only a `__proto__` filter; `constructor`/`prototype` keys, mismatched identifier/key-strings, non-string types, malformed composition and condition-set references and unknown root IDs were accepted. | CWE-1321, CWE-20 | V-222606 The application must validate all input. | SI-10 | CAT II | V-220631 | `not-satisfied` -> remediated: `importValidation.js` rejects reserved keys at any depth (bounded to 64 nesting levels / 20 reported errors), and validates root, identifiers, types, names, locations, composition and condition-set reference *syntax* before any `save()`. Composition references to objects absent from the payload are deliberately accepted because `ExportAsJSONAction#exportObject` omits non-creatable children (e.g. read-only telemetry) while leaving them in the parent's `composition`; such references resolve to a "Missing" placeholder at runtime and are never dereferenced as code. |
| F-02 | `src/plugins/importFromJSONAction/ImportFromJSONAction.js:106,452` | Import failures surfaced provider/parser text to the operator. | CWE-209 | V-222610 Error messages must not reveal exploitable information. | SI-11(a) | CAT II | V-220641 | `not-satisfied` -> remediated: generic `IMPORT_REJECTED_MESSAGE` / `SAVE_FAILED_MESSAGE`; diagnostics only in `console.error`. |
| F-03 | `src/plugins/importFromJSONAction/ImportFromJSONAction.js:348-350` | Partial persistence: objects were saved as the tree was walked, so a later validation failure left earlier objects persisted. | CWE-20 | V-222609 Not subject to input handling vulnerabilities. | SI-10(3) | CAT I | V-220631 | `not-satisfied` -> remediated: validation completes before the first `save()`; spec asserts zero `save` calls on invalid trees. |
| F-04 | `src/plugins/exportAsJSONAction/ExportAsJSONAction.js:102-107` | Export failure path rethrew raw errors to the UI. | CWE-209 | V-222610 | SI-11(a) | CAT II | V-220641 | `not-satisfied` -> remediated: generic notification, raw error logged, failure audit record. |
| F-05 | `src/plugins/notebook/components/NotebookEntry.vue:460-461` | Notebook Markdown was rendered through `marked` and `sanitize-html`, but the sanitizer schema and the custom link renderer allowed `data:`/protocol-relative links, suffix-matching of the hostname allowlist (`notexample.com` passed for `example.com`) and unescaped link text/URL in hand-built anchor markup. | CWE-79, CWE-20 | V-222602 Protect from Cross-Site Scripting (XSS). | SI-10 | CAT I | V-220632 | `not-satisfied` -> remediated: schema restricted to `http`/`https`/`mailto`, no protocol-relative URLs, allowed attributes enumerated; link renderer (`:211`, `:471-479`) requires `http(s):`, exact-host or dot-delimited subdomain match, and escapes text and `href`. |
| F-06 | `src/plugins/notebook/components/NotebookEntry.vue:571`, `NotebookComponent.vue:676-677`, `src/plugins/notebook/utils/notebook-image.js:72` | Image-drop failures interpolated the raw error into the operator notification. | CWE-209 | V-222610 | SI-11(a) | CAT II | V-220641 | `not-satisfied` -> remediated: `'Unable to add image.'` shown; error logged. |
| F-07 | `src/plugins/persistence/couch/CouchObjectProvider.js:233-235, 253-255, 278-285` | CouchDB network failures, HTTP error bodies and malformed responses propagated raw `fetch`/JSON error text (including server URL and CouchDB `reason` strings) to callers that display it. | CWE-209, CWE-755 | V-222610; V-222656 Not subject to error handling vulnerabilities. | SI-11(a), SA-15(5) | CAT II | V-220641 | `not-satisfied` -> remediated: normalized to `openmct.objects.errors.Persistence` (`src/api/objects/PersistenceError.js`) with a generic message; `Conflict` preserved; raw detail in `console.error`. |
| F-08 | `src/plugins/localStorage/LocalStorageObjectProvider.js:37, 47, 67, 89, 102-105` | `localStorage` access, quota and `JSON.parse` failures threw raw browser exceptions to callers. | CWE-209, CWE-755 | V-222610; V-222656 | SI-11(a), SA-15(5) | CAT II | V-220641 | `not-satisfied` -> remediated: normalized to `PersistenceError`; raw detail logged. |
| F-09 | `src/utils/textHighlight/TextHighlight.vue:24, 63-65` | Search-highlight component built HTML by string replacement with the user-supplied highlight term inserted into the markup and used as an unescaped regular expression. | CWE-79, CWE-1333 | V-222602 | SI-10 | CAT I | V-220632 | `not-satisfied` -> remediated: text and term HTML-escaped, term regex-escaped, class attribute escaped, match reinserted via `$1`. |
| F-10 | `innerHTML` sites: `src/ui/inspector/InspectorViews.vue:63`, `src/ui/components/ObjectView.vue:171`, `src/ui/preview/PreviewContainer.vue:115`, `src/plugins/inspectorViews/styles/SavedStylesInspectorView.vue:48,56`, `src/plugins/summaryWidget/src/SummaryWidget.js:209`, `.../TestDataItem.js:177`, `.../Condition.js:197`, `.../input/Select.js:88`, `src/plugins/notebook/components/NotebookSnapshotIndicator.vue:100`, `src/plugins/imagery/components/ImageryTimeView.vue:329`, `src/plugins/performanceIndicator/plugin.js:88`, `src/plugins/plot/chart/MctChart.vue:561` | Each site assigns an empty string or a static developer-authored template literal with no interpolated user data. `NotebookEntry.vue:318` returns sanitized output from F-05. | CWE-79 | V-222602 | SI-10 | CAT I | V-220632 | `satisfied` (no untrusted data reaches these sinks). Reviewer note: `MctChart.vue:561` and `performanceIndicator/plugin.js:88` interpolate only constants; re-review if they are ever given object-derived values. |
| F-11 | `src/plugins/formActions/CreateAction.js:94` | Object-creation failure interpolated the raw error object into the operator notification (`Error saving objects: ${err}`). Same pattern as F-02/F-04/F-06; `EditPropertiesAction.js:76` and `BrowseBar.vue:440` already used the generic form. | CWE-209 | V-222610 | SI-11(a) | CAT II | V-220641 | `not-satisfied` -> remediated: generic message, raw error logged. |
| F-12 | `src/ui/layout/AboutDialog.vue:30` | `v-html="branding.aboutHtml"`: content is the deployer's static `Branding` configuration (`src/api/Branding.js:29`), not end-user data. | CWE-79 | V-222602 | SI-10 | CAT I | V-220632 | `satisfied` (configuration-only sink). Deployers must treat `aboutHtml` as trusted markup. |
| F-13 | `src/api/user/UserAPI.js:135`, `src/api/faultmanagement/FaultManagementAPI.js:122-171`, `src/plugins/importFromJSONAction/ImportFromJSONAction.js:107,350,366`, `src/plugins/exportAsJSONAction/ExportAsJSONAction.js:107,391`, `src/plugins/notebook/utils/notebook-entries.js:242,266,335,356`, `src/plugins/notebook/components/NotebookComponent.vue:586` | No audit records were produced for operator actions that already carry a user context (import, export, role change, notebook entry create/delete, fault acknowledge/shelve). | CWE-778 | V-222471 Log user actions involving access to data; V-222472 Log user actions involving changes to data; V-222476 Audit records establish outcome; V-222477 Audit records establish identity. | AU-2, AU-3, AU-12 | CAT II | V-220635 | `not-satisfied` -> remediated: `src/api/audit/AuditLogger.js` registered as `openmct.audit` (`src/MCT.js:205`) emits `{id, source, timestamp, action, outcome, actor{id,username,role}, target, details}` to in-process subscribers; hooks at the listed sites, including policy-rejected imports (`ImportFromJSONAction.js` composition-policy branch). Role changes mirrored from another browsing context (`ActiveRoleSynchronizer`) are not re-recorded, so one selection yields one record. Public contract documented in `API.md` ("Audit API"). No external sink is configured (see F-20). |
| F-14 | `src/plugins/URLIndicatorPlugin/URLIndicator.js:78,100` | The indicator polls a deployer-configured URL with `fetch()` and reports reachability only; the response body is not rendered. Whether the configured URL uses TLS is a deployment setting. | CWE-319 | V-222596 Protect confidentiality and integrity of transmitted information. | SC-8 | CAT I | V-220634 | `needs-input` (URL scheme is configuration). Input handling: `satisfied` (no body rendering). |
| F-15 | `src/plugins/persistence/couch/plugin.js:36-68`, `CouchObjectProvider.js:39,218,464` | CouchDB base URL is deployer configuration; the client uses `fetch()` and inherits browser cookies. TLS termination and TLS version policy are not visible in source. | CWE-319 | V-222596; V-222597 Cryptographic mechanisms during transmission. | SC-8, SC-8(1), SC-13 | CAT I | V-220634 | `needs-input`. |
| F-16 | `src/plugins/persistence/couch/CouchObjectProvider.js:218` | No credentials are embedded in source (`satisfied` for V-222642 / IA-5(7)). Authentication to CouchDB (proxy auth, cookie session, IdP) is external to this code. | CWE-306 | V-222522 Uniquely identify and authenticate organizational users; V-222642 No embedded authentication data. | IA-2, IA-5(7), AC-3 | CAT I | V-220629 | `needs-input` for IA-2/AC-3; `satisfied` for IA-5(7). |
| F-17 | `example/exampleUser/ExampleUserProvider.js:96-117, 228-240`, `src/api/user/UserAPI.js`, `src/plugins/userIndicator/components/UserIndicator.vue:158-160`, `src/plugins/operatorStatus/` | The bundled user provider is an example in-memory provider with an auto-login path; it is not an authentication mechanism and must not be deployed as one. The `UserAPI` provider interface carries identity, roles and status but does not itself enforce authorization on object operations. Poll-question and status inputs (`PollQuestion.vue:69`) are rendered with `{{ }}` text interpolation (`satisfied` for XSS). | CWE-287, CWE-285 | V-222522; V-222425 Enforce approved authorizations; V-222556 Non-organizational users. | IA-2, AC-3, AC-6 | CAT I | V-220629 | `needs-input`: production `UserProvider` implementation and the authorization model enforced by the persistence tier. Example provider: `not-applicable` for production evidence. |
| F-18 | `src/plugins/localStorage/LocalStorageObjectProvider.js`, `src/api/user/StoragePersistence.js:27-33` | Domain objects (LocalStorage provider) and the active role are stored unencrypted in browser `localStorage`; CouchDB at-rest protection is server-side. | CWE-312 | V-222587 Protect confidentiality and integrity of stored information; V-222588 Approved cryptographic mechanisms for information at rest. | SC-28, SC-28(1) | CAT II / CAT I | V-220633 | `needs-input`: data-sensitivity determination for browser-stored objects and CouchDB/host encryption evidence. |
| F-19 | Not in source (browser session, reverse proxy, IdP) | Session identifiers, inactivity timeout, logoff, cookie flags and concurrent-session limits are provided by the deployment (proxy/IdP), not by this client. | CWE-613, CWE-614 | V-222577 Do not expose session IDs; V-222389 15-minute idle termination; V-222391 Logoff capability; V-222388 Clear temporary storage and cookies on termination; V-222387 Limit logon sessions. | AC-7, AC-12, SC-23 | CAT I / CAT II | V-220630 | `needs-input`. |
| F-20 | `src/api/audit/AuditLogger.js` (in-process only) | Audit records are delivered to in-process subscribers; forwarding to a protected, centralized log store with a unique application identifier is a deployment integration. | CWE-778 | V-222475 Unique identifier when using centralized logging. | AU-4, AU-6, AU-9 | CAT II | V-220635 | `needs-input`: a provider that ships records to the site logging system, and evidence of retention/protection. |
| F-21 | `src/plugins/condition/utils/operations.js:45`, `src/plugins/summaryWidget/src/ConditionEvaluator.js:344-413` | User-authored Condition Set criteria and Summary Widget rules are evaluated by looking up a named operation in a fixed table of functions; no `eval`, `new Function` or template compilation of user text was found in `src/` or `example/`. | CWE-94, CWE-95 | V-222609; V-222604 Protect from command injection. | SI-10, CM-7 | CAT I | V-220631 | `satisfied` (Comps `mathjs` evaluation is covered by #10 and excluded here). |
| F-22 | `src/plugins/hyperlink/HyperlinkLayout.vue:37,50` | Hyperlink `href` is passed through `@braintree/sanitize-url`, which blocks `javascript:`, `data:` and other non-navigational schemes. | CWE-79 | V-222602 | SI-10 | CAT I | V-220632 | `satisfied`. |
| F-23 | `src/plugins/notebook/components/NotebookEmbed.vue:31`, `src/plugins/notebook/utils/notebook-image.js:8-20,60` | Snapshot thumbnails and full-size images are bound with `:src` (attribute binding, not markup) and originate from canvas captures / object-URLs created by the application; entry embeds render object names via text interpolation. | CWE-79 | V-222602 | SI-10 | CAT I | V-220632 | `satisfied`. |
| F-24 | `src/plugins/notebook/components/NotebookEntry.vue:684` | Entry text saved from the editor is stripped to plain text with `sanitize-html` (`allowedTags: []`) before storage. | CWE-79 | V-222606 | SI-10 | CAT II | V-220631 | `satisfied`. |
| F-25 | `src/api/objects/ObjectAPI.js:441` | Conflict notification interpolates the object key-string (application identifier, not error internals). | CWE-209 | V-222600 Do not disclose unnecessary information. | SI-11 | CAT II | V-220641 | `satisfied` (identifier only, no internal detail). |

### Counts by outcome

| Outcome | Count | Findings |
| --- | --- | --- |
| `not-satisfied` -> remediated in this change set | 11 | F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-08, F-09, F-11, F-13 |
| `satisfied` | 7 | F-10, F-12, F-21, F-22, F-23, F-24, F-25 |
| `needs-input` | 7 | F-14, F-15, F-16, F-17, F-18, F-19, F-20 |
| `not-applicable` | 1 | F-17 (example user provider as production authentication evidence) |
| `not-satisfied` left open | 0 | - |

## Remediated in this change set

| Remediation | Files | Karma specs |
| --- | --- | --- |
| R1 Import schema validation and prototype-pollution protection (F-01, F-02, F-03) | `src/plugins/importFromJSONAction/importValidation.js`, `ImportFromJSONAction.js` | `importValidationSpec.js`, `ImportFromJSONActionSpec.js` |
| R2 Notebook and `v-html` XSS hardening (F-05, F-06, F-09) | `src/plugins/notebook/components/NotebookEntry.vue`, `NotebookComponent.vue`, `src/utils/textHighlight/TextHighlight.vue` | `NotebookEntrySpec.js`, `TextHighlightSpec.js` |
| R3 Generic persistence error handling (F-04, F-07, F-08, F-11) | `src/api/objects/PersistenceError.js`, `ObjectAPI.js`, `src/plugins/persistence/couch/CouchObjectProvider.js`, `src/plugins/localStorage/LocalStorageObjectProvider.js`, `src/plugins/exportAsJSONAction/ExportAsJSONAction.js`, `src/plugins/formActions/CreateAction.js` | `couch/pluginSpec.js`, `localStorage/pluginSpec.js`, `ExportAsJSONActionSpec.js`, `CreateActionSpec.js` |
| R4 Structured audit-event hook (F-13) | `src/api/audit/AuditLogger.js`, `src/MCT.js`, `src/api/user/UserAPI.js`, `src/api/faultmanagement/FaultManagementAPI.js`, import/export actions, `src/plugins/notebook/utils/notebook-entries.js`, `NotebookComponent.vue` | `AuditLoggerSpec.js`, `UserAPISpec.js`, `FaultManagementAPISpec.js`, `notebook-entriesSpec.js`, import/export specs |

Root-cause notes:

- The raw-error-to-operator pattern (F-02, F-04, F-06, F-07, F-08, F-11) was
  distributed across six sites with no central rule. R3 centralizes provider
  failures in `PersistenceError` so that any caller that displays
  `error.message` from the object API now shows generic text; the remaining
  UI-level sites were changed individually. New code that displays an error to
  the operator should show fixed text and pass the error object to
  `console.error`.
- Audit hooks (R4) are placed in the API layer (`UserAPI`,
  `FaultManagementAPI`) where possible so that any UI that calls those APIs is
  covered; Notebook and import/export hooks live in the actions because there
  is no shared API layer for those operations.

### Audit record shape

```json
{
  "id": "uuid",
  "source": "openmct",
  "timestamp": "2026-09-07T20:00:00.000Z",
  "action": "fault.acknowledge",
  "outcome": "success",
  "actor": { "id": "user-id", "username": "operator", "role": "flight" },
  "target": { "type": "fault", "id": "..." },
  "details": {}
}
```

Providers subscribe with `openmct.audit.addProvider({ record(auditRecord) {} })`.
Actions recorded: `import`, `export`, `user.role.change`,
`notebook.entry.create`, `notebook.entry.delete`, `fault.acknowledge`,
`fault.shelve`.

## Documented / needs-input

An ISSM or assessor would need to supply the following to close the
`needs-input` rows. None of these can be inferred from this repository.

| Item | Closes | Evidence requested |
| --- | --- | --- |
| CouchDB transport | F-15 | Reverse-proxy or CouchDB TLS configuration showing TLS 1.2+ only, cipher policy, certificate chain, and that the configured `url` is `https://`. |
| URL indicator target | F-14 | The configured indicator URL and its TLS posture. |
| CouchDB authentication and authorization | F-16, F-17 | How browser requests to CouchDB are authenticated (proxy authentication, IdP/OIDC, CouchDB cookie sessions), and the CouchDB `_security` / per-database role model that enforces AC-3 for read and write. |
| Production `UserProvider` | F-17 | The deployed `UserProvider` implementation, its IdP integration, MFA policy, and role source. The bundled `example/exampleUser` provider is not production evidence. |
| Session policy | F-19 | Proxy/IdP settings for idle timeout (15 min non-privileged / 10 min admin), logoff, concurrent-session limit, and cookie flags (`Secure`, `HttpOnly`, `SameSite`). |
| Storage encryption | F-18 | Data-sensitivity determination for objects held in browser `localStorage`; CouchDB host disk / volume encryption evidence. |
| Security headers | F-05, F-09 (defense in depth) | Reverse-proxy response headers: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` / `frame-ancestors`. Not set by this client. |
| Centralized audit logging | F-20 | An `openmct.audit` provider that forwards records to the site log store, the unique application identifier used, and retention/protection settings. |

## Verification evidence

Commands run on the remediated branch (Node 24.14.1):

```text
npm run lint            # eslint (js + vue) and cspell: clean
npm test                # karma: TOTAL: 1061 SUCCESS (67 skipped)
```

Baseline on `master` (`a4aae41af`): `TOTAL: 6 FAILED, 969 SUCCESS`. The six
baseline failures (Object API search x4, Image Exporter x1, URLIndicator
default icon class x1) are environment-sensitive, are not modified by this
change set, and did not reproduce on the final branch run. The branch adds 92
specs and no regressions; the CI `unit-test` job passes.

### Original prompt

```text
Do an Application Security & Development STIG and NIST SP 800-53 Rev. 5 review of Open MCT's untrusted-input boundaries (import/export JSON, notebook entries, URL plugins, CouchDB/localStorage persistence, user/role plugins, expression evaluation). Produce a findings table with file:line, CWE, ASD STIG rule ID, NIST control, severity and an explicit outcome for every boundary (satisfied / not-satisfied / needs-input / not-applicable). Then remediate the top findings in one PR with unit tests: schema validation and prototype-pollution protection on import, XSS sanitization on notebook sinks, generic error handling on persistence failures, and a structured audit-event hook for operator actions. Keep lint and the test suite green and show a baseline comparison.
```
