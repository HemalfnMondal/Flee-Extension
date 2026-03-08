# Flee Autofill Extension

A Chrome Extension (Manifest V3) that automatically fills Park University application forms to speed up testing and development workflows.

---

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [How to Use](#how-to-use)
- [Supported Pages](#supported-pages)
  - [Registration Page](#1-registration-page)
  - [My Profile Page](#2-my-profile-page)
  - [Domestic Demographics Page](#3-domestic-demographics-page)
  - [Domestic Educational History Page](#4-domestic-educational-history-page)
- [Keyboard Shortcut](#keyboard-shortcut)
- [Known Issues](#known-issues)
- [Project Structure](#project-structure)
- [Future Improvements](#future-improvements)

---

## Overview

The Flee Autofill Extension detects the current Park University application page by its URL and fills in all required form fields with randomly generated or fixed test data. It eliminates manual data entry during form testing and development.

The autofill can be triggered in two ways:

- **Clicking the extension icon** in the Chrome toolbar.
- **Pressing the `0` key** on the keyboard while on a supported page.

---

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked**.
5. Select the project folder (`Flee-Extention`).
6. The extension will appear in the toolbar.

---

## How to Use

1. Navigate to any supported Park University application page.
2. Trigger the autofill in one of two ways:
   - Click the **Flee Autofill** extension icon in the Chrome toolbar.
   - Press the **`0` key** on your keyboard (only works when focus is not inside an input or textarea field).
3. The extension will detect the current page URL and automatically fill all supported fields.

---

## Supported Pages

### 1. Registration Page

**URL contains:** `pageId=Registration`

**Example URL:**
```
https://parkuniversity.my.site.com/ApplicationPortal/apex/ERx_Forms__PageMaker?pageId=Registration
```

**Fields autofilled:**

| Field | Value |
|---|---|
| First Name | Random realistic first name (e.g. Liam, Emma, Noah) |
| Last Name | Random realistic last name (e.g. Smith, Taylor, Brown) |
| Email | Random 3–5 digit number + `@hemalmondalphilosophy.me` |
| Cell Phone | Random 9-digit number |
| Create Password | `Neela63352..` |
| Password Confirm | `Neela63352..` |
| Choose a Location | `Campus Center` |
| Current High School Student | Checkbox checked |

---

### 2. My Profile Page

**URL contains:** `pageId=My_Profile`

**Example URL:**
```
https://parkuniversity.my.site.com/ApplicationPortal/ERx_Forms__PageMaker?pageId=My_Profile
```

**Fields autofilled:**

| Field | Value |
|---|---|
| Military Service | No |
| Citizenship Status | US Citizen |
| Student Type | Undergraduate |
| Location | Online & Campus Centers |
| Program Type | Certificate |
| Program | Certificate in Personal Financial Planning |
| Start Term | Fall 2026 (August 17 start) |

---

### 3. Domestic Demographics Page

**URL contains:** `pageId=Domestic_Demographics`

**Example URL:**
```
https://parkuniversity.my.site.com/ApplicationPortal/ERx_Forms__PageMaker?pageId=Domestic_Demographics&type=000
```

**Fields autofilled:**

| Field | Value |
|---|---|
| Country | United States |
| Address Line 1 | Random US street address (e.g. `4821 Maple St`) |
| Address Line 2 | Left empty |
| City | Random US city (e.g. Springfield, Dayton) |
| State / Province | Random US state abbreviation (e.g. TX, CA, FL) |
| Zip Code | Random 5-digit ZIP code |
| Is this your Mailing Address? | Yes |
| Social Security Number | Random 9-digit number ⚠️ *(see Known Issues)* |
| Country of Citizenship | United States of America |
| Date of Birth | `09/02/2005` |
| Country of Birth | United States of America |
| Gender | Male/Man |

---

### 4. Domestic Educational History Page

**URL contains:** `pageId=Domestic_Educational_History`

**Example URL:**
```
https://parkuniversity.my.site.com/ApplicationPortal/ERx_Forms__PageMaker?pageId=Domestic_Educational_History&type=000
```

**Automation steps performed:**

| Step | Action |
|---|---|
| High School / Home School CEEB Code | Types `"te"` into the lookup field, waits 800 ms, then clicks the first autocomplete suggestion |
| Did you graduate? | Selects `Yes` |
| Graduation Date | Sets `08/12/2025` |
| College classes prior to high school graduation | Selects `No` |
| *(1000 ms delay)* | Waits for Salesforce to process the previous selection |
| College classes after high school graduation | Selects `No` |

---

## Keyboard Shortcut

| Key | Action |
|---|---|
| `0` | Triggers autofill on the current page |

**Behaviour:**
- The shortcut fires on **`keydown`**.
- It is **ignored** when the focused element is an `<input>`, `<textarea>`, or any `contenteditable` element — so typing in form fields is never interrupted.
- It calls the same routing logic as the icon click, so behaviour is identical.

---

## Known Issues

| Field | Issue | Likely Cause |
|---|---|---|
| **Social Security Number** | Generated value does not register on submission | Salesforce Lightning masked input ignores programmatic `value` assignment and direct event dispatching |
| **State / Province** | Field does not fill correctly in some cases | Salesforce dynamically replaces the text input with a `<select>` picklist after Country is chosen; timing and shadow DOM nesting make reliable detection difficult |

These are Salesforce Lightning-specific limitations and require deeper investigation into the component's internal event handling.

---

## Project Structure

```
Flee-Extention/
├── manifest.json         # Chrome Extension Manifest V3 configuration
├── background.js         # Service worker — listens for icon click, sends message to content script
├── content.js            # Main content script — all autofill logic
├── generate_icons.py     # Python script that generates the butterfly icon PNGs
├── icons/
│   ├── icon16.png        # Toolbar icon (16×16)
│   ├── icon32.png        # Toolbar icon (32×32)
│   ├── icon48.png        # Extension management page icon (48×48)
│   └── icon128.png       # Chrome Web Store icon (128×128)
└── README.md             # This file
```

### File Responsibilities

**`manifest.json`**
- Declares Manifest V3.
- Requests `activeTab` and `scripting` permissions.
- Injects `content.js` on all `https://parkuniversity.my.site.com/*` pages.
- Registers `background.js` as the service worker.

**`background.js`**
- Listens for the extension icon click (`chrome.action.onClicked`).
- Sends `{ action: "runAutofill" }` to the active tab's content script.

**`content.js`**
- Detects the current page URL and routes to the correct autofill function.
- Contains all field detection, data generation, and DOM interaction logic.

Key functions:

| Function | Purpose |
|---|---|
| `runAutofill()` | Central router — called by both icon click and keyboard shortcut |
| `autofill()` | Fills the Registration page |
| `autofillMyProfile()` | Fills the My Profile page dropdowns |
| `autofillDomesticDemographics()` | Fills the Domestic Demographics form |
| `autofillDomesticEducationalHistory()` | Fills the Educational History form |
| `generateFirstName()` | Random first name |
| `generateLastName()` | Random last name |
| `generateEmail()` | Random email |
| `generatePhone()` | Random 9-digit phone number |
| `generateUSAddress()` | Random US street address |
| `generateCity()` | Random US city |
| `generateState()` | Random US state abbreviation |
| `generateZip()` | Random 5-digit ZIP code |
| `generateSSN()` | Random SSN formatted as `XXX-XX-XXXX` |
| `findInputDeep()` | Shadow-DOM-aware input element finder |
| `findElementDeep()` | Shadow-DOM-aware general element finder |
| `tryFillSelect()` | Fills a `<select>` by label keyword and option text |
| `tryFillInput()` | Fills a text input by label keyword |
| `setNativeValue()` | Fills an input using the native prototype setter (bypasses LWC) |
| `typeIntoInput()` | Simulates character-by-character typing for masked inputs |
| `fillInput()` | Standard input fill with React/LWC-compatible event dispatch |

---

## Future Improvements

- Fix SSN input compatibility with Salesforce Lightning masked fields
- Fix State/Province picklist detection after country selection
- Improve Salesforce dropdown detection across more component types
- Add support for additional application pages
- Improve fake identity generator (more realistic names, addresses, dates)
- Add an extension popup with controls (e.g. enable/disable, select profile)
- Support multiple autofill profiles for different test scenarios
- Add visual feedback (toast notification) when autofill completes
- Add configurable keyboard shortcut via extension options page
