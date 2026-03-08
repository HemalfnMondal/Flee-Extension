/**
 * content.js — Flee Autofill Extension
 *
 * Runs on pages matching: https://parkuniversity.my.site.com/*
 * Executes autofill logic only when the URL exactly matches the
 * Park University registration page, and only when triggered by
 * a message from the background service worker (icon click).
 */

"use strict";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** The only URL on which autofill is permitted to run. */
const TARGET_URL =
  "https://parkuniversity.my.site.com/ApplicationPortal/apex/ERx_Forms__PageMaker?pageId=Registration";

/** Password used for both the "Create Password" and "Password Confirm" fields. */
const FIXED_PASSWORD = "Neela63352..";

// ─────────────────────────────────────────────
// Random data generators
// ─────────────────────────────────────────────

/**
 * Returns a random realistic first name.
 * @returns {string}
 */
function generateFirstName() {
  const names = [
    "Liam", "Noah", "Emma", "Olivia", "Ava",
    "Ethan", "Mason", "Sophia", "Lucas", "Isabella",
    "James", "Aiden", "Mia", "Harper", "Evelyn",
    "Logan", "Jackson", "Charlotte", "Amelia", "Sofia",
  ];
  return names[Math.floor(Math.random() * names.length)];
}

/**
 * Returns a random realistic last name.
 * @returns {string}
 */
function generateLastName() {
  const names = [
    "Smith", "Johnson", "Brown", "Taylor", "Wilson",
    "Davis", "Martinez", "Anderson", "Thompson", "Garcia",
    "Harris", "Robinson", "Clark", "Lewis", "Walker",
    "Hall", "Allen", "Young", "Hernandez", "King",
  ];
  return names[Math.floor(Math.random() * names.length)];
}

/**
 * Returns a random email address with a 3–5 digit numeric prefix.
 * Format: <digits>@hemalmondalphilosophy.me
 * @returns {string}
 */
function generateEmail() {
  // Pick a random digit length between 3 and 5 (inclusive).
  const digitCount = Math.floor(Math.random() * 3) + 3; // 3, 4, or 5
  const min = Math.pow(10, digitCount - 1);
  const max = Math.pow(10, digitCount) - 1;
  const number = Math.floor(Math.random() * (max - min + 1)) + min;
  return `${number}@hemalmondalphilosophy.me`;
}

/**
 * Returns a random 9-digit phone number string.
 * @returns {string}
 */
function generatePhone() {
  // Ensure the first digit is never 0 so the number is truly 9 digits.
  const min = 100_000_000; // 9 digits starting at 1
  const max = 999_999_999;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

// ─────────────────────────────────────────────
// DOM utility helpers
// ─────────────────────────────────────────────

/**
 * Normalises a string for comparison: lowercased and trimmed.
 * @param {string|null|undefined} text
 * @returns {string}
 */
function normalize(text) {
  return (text ?? "").toLowerCase().trim();
}

/**
 * Resolve the visible label text associated with a form element.
 * Checks (in order):
 *   1. <label for="id"> association
 *   2. Ancestor <label> wrapping the element
 *   3. aria-label attribute
 *   4. aria-labelledby attribute
 *
 * @param {HTMLElement} element
 * @returns {string} Normalised label text, or "" if none found.
 */
function getLabelText(element) {
  // 1. Explicit <label for="..."> association.
  if (element.id) {
    const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (label) return normalize(label.textContent);
  }

  // 2. Parent <label> wrapping the element.
  const ancestorLabel = element.closest("label");
  if (ancestorLabel) return normalize(ancestorLabel.textContent);

  // 3. aria-label attribute.
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return normalize(ariaLabel);

  // 4. aria-labelledby pointing to another element.
  const labelledById = element.getAttribute("aria-labelledby");
  if (labelledById) {
    const labelEl = document.getElementById(labelledById);
    if (labelEl) return normalize(labelEl.textContent);
  }

  return "";
}

/**
 * Retrieves the text of any sibling / parent text node closest to the element.
 * Useful for checkboxes whose label text lives in an adjacent element.
 * @param {HTMLElement} element
 * @returns {string} Normalised combined text of the element's parent, or "".
 */
function getNearbyText(element) {
  return element.parentElement
    ? normalize(element.parentElement.textContent)
    : "";
}

// ─────────────────────────────────────────────
// Field filling helpers
// ─────────────────────────────────────────────

/**
 * Sets the value of a text/email/tel/password input in a way that
 * triggers React / framework change detection as well as native events.
 * @param {HTMLInputElement} input
 * @param {string} value
 */
function fillInput(input, value) {
  // Use the native value setter so React synthetic events fire correctly.
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;

  if (nativeSetter) {
    nativeSetter.call(input, value);
  } else {
    input.value = value;
  }

  // Dispatch both input and change events to notify any listeners.
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Selects an option inside a <select> element by iterating every option and
 * matching against its visible textContent (most reliable on Salesforce pages).
 * Falls back to matching the option value attribute.
 *
 * @param {HTMLSelectElement} select
 * @param {string} searchText  Partial, case-insensitive match target.
 * @returns {boolean} Whether a matching option was found and selected.
 */
function selectOption(select, searchText) {
  const target = normalize(searchText);

  for (const option of select.options) {
    const text  = normalize(option.textContent);
    const value = normalize(option.value);

    if (text.includes(target) || value.includes(target)) {
      select.value = option.value;
      // Salesforce requires both a "change" and an "input" event to update
      // its internal Lightning / Aura component state.
      select.dispatchEvent(new Event("input",  { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
  }
  return false;
}

/**
 * Dedicated handler for the "Choose a Location" dropdown.
 *
 * Strategy:
 *  1. Wait INITIAL_DELAY ms (Salesforce often renders the dropdown after the
 *     initial page load, so an immediate query usually returns 0 options).
 *  2. Attempt to find and fill the dropdown.
 *  3. If the dropdown or the required option is not yet present, install a
 *     MutationObserver to re-try on every DOM mutation until success or
 *     MAX_WAIT_MS has elapsed.
 *
 * @returns {Promise<void>} Resolves when the dropdown is filled or timed out.
 */
function fillLocationDropdown() {
  return new Promise((resolve) => {
    /** Total time (ms) to wait for the dropdown before giving up. */
    const MAX_WAIT_MS   = 8000;
    /** Initial pause before the first attempt — gives Salesforce time to render. */
    const INITIAL_DELAY = 1000;

    /**
     * Scans all <select> elements on the page, finds the one associated with
     * "Choose a Location", then iterates its options looking for "Campus Center".
     * @returns {boolean} true if the option was found and selected.
     */
    function tryFill() {
      const selects = document.querySelectorAll("select");

      for (const select of selects) {
        const label = getLabelText(select);

        // Only consider selects that look like the location dropdown.
        if (!isLocationSelect(select, label)) continue;

        // Iterate every option and match by visible text.
        for (const option of select.options) {
          if (normalize(option.textContent).includes("campus center")) {
            select.value = option.value;
            select.dispatchEvent(new Event("input",  { bubbles: true }));
            select.dispatchEvent(new Event("change", { bubbles: true }));
            console.log(
              `[Flee Autofill] Location set → "${option.textContent.trim()}"`
            );
            return true;
          }
        }

        // The <select> exists but "Campus Center" isn't loaded yet.
        console.log(
          "[Flee Autofill] Location <select> found but 'Campus Center' option " +
          "not yet rendered — will retry…"
        );
      }
      return false;
    }

    // ── Step 1: initial delay ──────────────────────────────────────────────
    setTimeout(() => {
      if (tryFill()) {
        resolve();
        return;
      }

      // ── Step 2: MutationObserver fallback ───────────────────────────────
      console.log(
        "[Flee Autofill] Location dropdown not ready — watching DOM for changes…"
      );

      const deadline = Date.now() + (MAX_WAIT_MS - INITIAL_DELAY);

      const observer = new MutationObserver(() => {
        // Bail out if we have exceeded the maximum wait time.
        if (Date.now() > deadline) {
          observer.disconnect();
          console.error(
            "[Flee Autofill] Timed out waiting for 'Campus Center' option."
          );
          resolve();
          return;
        }

        if (tryFill()) {
          observer.disconnect();
          resolve();
        }
      });

      // Watch the entire document body for any child or subtree additions.
      observer.observe(document.body, { childList: true, subtree: true });
    }, INITIAL_DELAY);
  });
}

/**
 * Checks a checkbox and fires the appropriate events.
 * @param {HTMLInputElement} checkbox
 */
function checkCheckbox(checkbox) {
  if (!checkbox.checked) {
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("click", { bubbles: true }));
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

// ─────────────────────────────────────────────
// Field matchers
// ─────────────────────────────────────────────

/**
 * Determine whether an element matches "First Name".
 * @param {HTMLInputElement} el
 * @param {string} label
 * @returns {boolean}
 */
function isFirstNameField(el, label) {
  const placeholder = normalize(el.placeholder);
  const name       = normalize(el.name);
  const id         = normalize(el.id);

  return (
    placeholder.includes("first name") ||
    label.includes("first name")       ||
    name === "firstname" || name === "first_name" || name === "first" ||
    id   === "firstname" || id   === "first_name" || id   === "firstname"
  );
}

/**
 * Determine whether an element matches "Last Name".
 * @param {HTMLInputElement} el
 * @param {string} label
 * @returns {boolean}
 */
function isLastNameField(el, label) {
  const placeholder = normalize(el.placeholder);
  const name       = normalize(el.name);
  const id         = normalize(el.id);

  return (
    placeholder.includes("last name") ||
    label.includes("last name")       ||
    name === "lastname" || name === "last_name" || name === "last" ||
    id   === "lastname" || id   === "last_name" || id   === "lastname"
  );
}

/**
 * Determine whether an element matches the "Email" field.
 * @param {HTMLInputElement} el
 * @param {string} label
 * @returns {boolean}
 */
function isEmailField(el, label) {
  const placeholder = normalize(el.placeholder);
  const name       = normalize(el.name);
  const id         = normalize(el.id);
  const type       = normalize(el.type);

  return (
    type === "email"              ||
    placeholder.includes("email")||
    label.includes("email")       ||
    name.includes("email")        ||
    id.includes("email")
  );
}

/**
 * Determine whether an element matches the "Cell Phone" field.
 * @param {HTMLInputElement} el
 * @param {string} label
 * @returns {boolean}
 */
function isPhoneField(el, label) {
  const placeholder = normalize(el.placeholder);
  const name       = normalize(el.name);
  const id         = normalize(el.id);
  const type       = normalize(el.type);

  return (
    type === "tel"                      ||
    placeholder.includes("phone")       ||
    placeholder.includes("cell")        ||
    placeholder.includes("mobile")      ||
    label.includes("cell phone")        ||
    label.includes("phone")             ||
    label.includes("mobile")            ||
    name.includes("phone")              ||
    name.includes("cell")               ||
    id.includes("phone")                ||
    id.includes("cell")
  );
}

/**
 * Determine whether a password field is the "Create Password" field
 * (i.e. it is NOT the confirm / verify field).
 * @param {HTMLInputElement} el
 * @param {string} label
 * @returns {boolean}
 */
function isCreatePasswordField(el, label) {
  if (normalize(el.type) !== "password") return false;

  const placeholder = normalize(el.placeholder);
  const name       = normalize(el.name);
  const id         = normalize(el.id);

  // Must mention password but NOT confirmation.
  const mentionsPassword   = label.includes("password") || placeholder.includes("password") || name.includes("password") || id.includes("password");
  const mentionsConfirm    = label.includes("confirm")  || label.includes("verify")  ||
                              placeholder.includes("confirm") || placeholder.includes("verify") ||
                              name.includes("confirm")  || name.includes("verify")  ||
                              id.includes("confirm")    || id.includes("verify");

  return mentionsPassword && !mentionsConfirm;
}

/**
 * Determine whether a password field is the "Password Confirm" field.
 * @param {HTMLInputElement} el
 * @param {string} label
 * @returns {boolean}
 */
function isConfirmPasswordField(el, label) {
  if (normalize(el.type) !== "password") return false;

  const placeholder = normalize(el.placeholder);
  const name       = normalize(el.name);
  const id         = normalize(el.id);

  return (
    label.includes("confirm")       ||
    label.includes("verify")        ||
    placeholder.includes("confirm") ||
    placeholder.includes("verify")  ||
    name.includes("confirm")        ||
    name.includes("verify")         ||
    id.includes("confirm")          ||
    id.includes("verify")
  );
}

/**
 * Determine whether a <select> element is the "Choose a Location" dropdown.
 * @param {HTMLSelectElement} el
 * @param {string} label
 * @returns {boolean}
 */
function isLocationSelect(el, label) {
  const name = normalize(el.name);
  const id   = normalize(el.id);

  return (
    label.includes("location")  ||
    name.includes("location")   ||
    id.includes("location")
  );
}

/**
 * Determine whether a checkbox represents "Current High School Student".
 * @param {HTMLInputElement} el
 * @param {string} label
 * @returns {boolean}
 */
function isHighSchoolCheckbox(el, label) {
  const nearby = getNearbyText(el);
  return (
    label.includes("current high school student") ||
    nearby.includes("current high school student")
  );
}

// ─────────────────────────────────────────────
// Main autofill routine
// ─────────────────────────────────────────────

/**
 * Scans all form elements on the page and fills them according to
 * the field rules defined in the extension requirements.
 * Only runs when the page URL exactly matches TARGET_URL.
 */
function autofill() {
  // ── URL guard ────────────────────────────────
  if (window.location.href !== TARGET_URL) {
    console.warn(
      "[Flee Autofill] URL does not match target. Autofill skipped.\n",
      "Current:", window.location.href,
      "\nTarget: ", TARGET_URL
    );
    return;
  }

  // ── Generate random data for this run ────────
  const firstName = generateFirstName();
  const lastName  = generateLastName();
  const email     = generateEmail();
  const phone     = generatePhone();

  console.log("[Flee Autofill] Starting autofill with:", {
    firstName, lastName, email, phone, password: FIXED_PASSWORD,
  });

  // ── Scan every input, select, and textarea ───
  const elements = document.querySelectorAll("input, select, textarea");

  elements.forEach((el) => {
    const tag   = el.tagName.toLowerCase();       // "input" | "select" | "textarea"
    const type  = normalize(el.type);             // e.g. "text", "email", "checkbox"
    const label = getLabelText(el);               // resolved label text

    // ── Skip non-empty fields (except checkboxes, which have no text value) ──
    if (type !== "checkbox" && el.value && el.value.trim() !== "") {
      return;
    }

    // ── <select> elements ──────────────────────
    // The location dropdown is handled separately by fillLocationDropdown()
    // (with its own delay + MutationObserver retry) — skip it here.
    if (tag === "select") {
      return;
    }

    // ── Checkbox elements ──────────────────────
    if (type === "checkbox") {
      if (isHighSchoolCheckbox(el, label)) {
        checkCheckbox(el);
        console.log("[Flee Autofill] Checked 'Current High School Student'.");
      }
      return;
    }

    // ── Text / email / tel / password inputs ───

    if (isFirstNameField(el, label)) {
      fillInput(el, firstName);
      console.log(`[Flee Autofill] First Name → "${firstName}"`);
      return;
    }

    if (isLastNameField(el, label)) {
      fillInput(el, lastName);
      console.log(`[Flee Autofill] Last Name → "${lastName}"`);
      return;
    }

    if (isEmailField(el, label)) {
      fillInput(el, email);
      console.log(`[Flee Autofill] Email → "${email}"`);
      return;
    }

    if (isPhoneField(el, label)) {
      fillInput(el, phone);
      console.log(`[Flee Autofill] Phone → "${phone}"`);
      return;
    }

    // Password confirm must be checked BEFORE create-password to avoid
    // the confirm field being matched by the broader password check.
    if (isConfirmPasswordField(el, label)) {
      fillInput(el, FIXED_PASSWORD);
      console.log("[Flee Autofill] Password Confirm filled.");
      return;
    }

    if (isCreatePasswordField(el, label)) {
      fillInput(el, FIXED_PASSWORD);
      console.log("[Flee Autofill] Create Password filled.");
      return;
    }
  });

  // ── Location dropdown (delayed + MutationObserver) ────────────────────
  // Fired as a fire-and-forget Promise so the rest of the autofill completes
  // immediately while the dropdown waits for Salesforce to render its options.
  fillLocationDropdown().then(() => {
    console.log("[Flee Autofill] Location dropdown routine finished.");
  });

  console.log("[Flee Autofill] Autofill complete (dropdown fill running in background).");
}

// ─────────────────────────────────────────────
// Message listener (triggered by icon click)
// ─────────────────────────────────────────────

/**
 * The background service worker sends { action: "runAutofill" } when
 * the user clicks the extension icon.
 * autofill() is synchronous; fillLocationDropdown() runs as a background
 * Promise, so we can respond to the caller immediately.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === "runAutofill") {
    autofill();            // sync fields filled immediately
    sendResponse({ success: true });
  }
});
