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

/**
 * URL fragment that identifies the My Profile page.
 * Matched with String.prototype.includes() so variations in the base path
 * (e.g. with or without /apex/) are all handled correctly.
 */
const MY_PROFILE_URL_FRAGMENT = "pageId=My_Profile";

/**
 * URL fragment that identifies the Domestic Demographics page.
 * Matched with String.prototype.includes().
 */
const DOMESTIC_DEMOGRAPHICS_URL_FRAGMENT = "pageId=Domestic_Demographics";

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

/**
 * Returns a random realistic US street address.
 * Format: "<number> <street name> <suffix>"
 * Example: "4821 Maple St"
 * @returns {string}
 */
function generateUSAddress() {
  const number    = Math.floor(Math.random() * 9900) + 100; // 100–9999
  const streets   = [
    "Maple", "Oak", "Pine", "Elm", "Cedar", "Birch", "Walnut",
    "Willow", "Ash", "Cherry", "Spruce", "Hickory", "Sycamore",
    "Poplar", "Chestnut", "Magnolia", "Linden", "Dogwood",
  ];
  const suffixes  = ["St", "Ave", "Dr", "Blvd", "Ln", "Rd", "Way", "Ct"];
  const street    = streets[Math.floor(Math.random() * streets.length)];
  const suffix    = suffixes[Math.floor(Math.random() * suffixes.length)];
  return `${number} ${street} ${suffix}`;
}

/**
 * Returns a random US city name.
 * @returns {string}
 */
function generateCity() {
  const cities = [
    "Springfield", "Franklin", "Georgetown", "Greenville", "Madison",
    "Fairview", "Bristol", "Clinton", "Salem", "Arlington",
    "Burlington", "Centerville", "Dayton", "Milford", "Oakland",
    "Newport", "Hudson", "Riverside", "Florence", "Lexington",
  ];
  return cities[Math.floor(Math.random() * cities.length)];
}

/**
 * Returns a random US state abbreviation.
 * @returns {string}
 */
function generateState() {
  const states = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  ];
  return states[Math.floor(Math.random() * states.length)];
}

/**
 * Returns a random 5-digit US ZIP code string (zero-padded).
 * @returns {string}
 */
function generateZip() {
  // Range 10000–99999 gives realistic-looking 5-digit ZIPs.
  return String(Math.floor(Math.random() * 90000) + 10000);
}

/**
 * Returns a random Social Security Number formatted as XXX-XX-XXXX.
 * Example: 384-52-9184
 * @returns {string}
 */
function generateSSN() {
  const part1 = Math.floor(100 + Math.random() * 900);  // 100–999
  const part2 = Math.floor(10  + Math.random() * 90);   // 10–99
  const part3 = Math.floor(1000 + Math.random() * 9000); // 1000–9999
  return `${part1}-${part2}-${part3}`;
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
 * General-purpose helper: scans all <select> elements, matches one using a
 * list of label keywords, then selects the option whose visible text includes
 * the target string.
 *
 * Label matching tests (all normalised to lowercase):
 *   - resolved <label> text via getLabelText()
 *   - surrounding parent text via getNearbyText()
 *   - the element's name attribute
 *   - the element's id attribute
 *
 * @param {string[]} labelKeywords  One or more lowercase substrings to match.
 * @param {string}   optionText     Partial text of the option to select.
 * @returns {boolean} true if the option was found and selected.
 */
function tryFillSelect(labelKeywords, optionText) {
  const targetOption = normalize(optionText);

  for (const select of document.querySelectorAll("select")) {
    // Build a single normalised fingerprint for this select element.
    const fingerprint = [
      getLabelText(select),
      getNearbyText(select),
      normalize(select.name),
      normalize(select.id),
    ].join(" ");

    // At least one keyword must match.
    const matched = labelKeywords.some((kw) =>
      fingerprint.includes(normalize(kw))
    );
    if (!matched) continue;

    // Walk the option list — match on visible TEXT or on the VALUE attribute.
    // Checking value is critical for state abbreviations (e.g. value="TX").
    for (const option of select.options) {
      const text  = normalize(option.textContent);
      const value = normalize(option.value);
      if (text.includes(targetOption) || value.includes(targetOption)) {
        select.value = option.value;
        // Salesforce Lightning / Aura needs both input + change to react.
        select.dispatchEvent(new Event("input",  { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }
  }
  return false;
}

/**
 * Simulates a real user typing text into an input field, character by character.
 *
 * This is necessary for Salesforce masked inputs (e.g. SSN) that ignore
 * programmatic `input.value = ...` assignment and only react to keyboard events.
 *
 * For each character the function:
 *   1. Appends the character to `input.value`
 *   2. Fires `input` + `keydown` + `keyup` events
 *   3. Waits 40 ms to mimic human typing speed
 * Then fires a final `change` event when done.
 *
 * @param {HTMLInputElement} input  The target input element.
 * @param {string}           text   The full string to type in.
 * @returns {Promise<void>}
 */
async function typeIntoInput(input, text) {
  input.focus();
  input.value = "";

  for (const char of text) {
    input.value += char;

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup",   { bubbles: true }));

    // Small delay between keystrokes so the masking library can process each one.
    await new Promise((r) => setTimeout(r, 40));
  }

  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Sets a value on an input using the native HTMLInputElement prototype setter,
 * then fires input + change events.  This bypasses React / Vue / LWC property
 * descriptors that would otherwise intercept and ignore a plain assignment.
 *
 * @param {HTMLInputElement} element
 * @param {string}           value
 */
function setNativeValue(element, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype, "value"
  ).set;
  valueSetter.call(element, value);
  element.dispatchEvent(new Event("input",  { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Searches for an <input> element matching any of the given keywords across
 * the entire document, including inside open and closed Shadow DOM roots
 * (Salesforce Lightning Web Components render real <input> elements inside
 * shadow roots that are invisible to document.querySelectorAll).
 *
 * Matching tests the same fingerprint used elsewhere:
 *   resolved label text · placeholder · name · id · nearby parent text
 *
 * @param {string[]} keywords   Lowercase substrings to match.
 * @param {Node}     [root]     Starting root node (defaults to document.body).
 * @returns {HTMLInputElement|null}
 */
function findInputDeep(keywords, root) {
  root = root || document.body;

  // Walk every element in this root.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node;

  while ((node = walker.nextNode())) {
    // Recurse into shadow roots if present.
    if (node.shadowRoot) {
      const found = findInputDeep(keywords, node.shadowRoot);
      if (found) return found;
    }

    if (node.tagName !== "INPUT") continue;

    const type = normalize(node.type);
    if (["submit", "button", "hidden", "checkbox", "radio", "file"].includes(type)) continue;

    const fingerprint = [
      getLabelText(node),
      normalize(node.placeholder),
      normalize(node.name),
      normalize(node.id),
      getNearbyText(node),
    ].join(" ");

    if (keywords.some((kw) => fingerprint.includes(normalize(kw)))) {
      return node;
    }
  }

  return null;
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

// ─────────────────────────────────────────────────────────────────────────────
// My Profile page autofill  (pageId=My_Profile)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Descriptor for a single dropdown field on the My Profile page.
 * @typedef  {Object} DropdownField
 * @property {string}   name          Human-readable name used in log messages.
 * @property {string[]} labelKeywords Lowercase substrings that identify the <select>.
 * @property {string}   optionText    Partial text of the option to select.
 */

/**
 * All dropdown fields that must be filled on the My Profile page, in order.
 * @type {DropdownField[]}
 */
const MY_PROFILE_FIELDS = [
  {
    name: "Military Service",
    // Match the long question text about US Armed Forces / National Guard.
    labelKeywords: ["armed forces", "national guard", "served in the united states", "military"],
    optionText: "No",
  },
  {
    name: "Citizenship Status",
    labelKeywords: ["citizenship"],
    optionText: "US Citizen",
  },
  {
    name: "Student Type",
    labelKeywords: ["student type", "type of student"],
    optionText: "Undergraduate",
  },
  {
    name: "Location",
    labelKeywords: ["location"],
    optionText: "Online & Campus Centers",
  },
  {
    name: "Program Type",
    labelKeywords: ["program type", "type of program"],
    optionText: "Certificate",
  },
  {
    name: "Program",
    // Keep keywords specific enough to avoid matching "Program Type".
    labelKeywords: ["program name", "select program", "choose program", "program"],
    optionText: "Certificate in Personal Financial Planning",
  },
  {
    name: "Start Term",
    labelKeywords: ["start term", "term", "start date", "when will you", "semester"],
    optionText: "Fall 2026",
  },
];

/**
 * Fills all My Profile dropdowns defined in MY_PROFILE_FIELDS.
 *
 * Strategy (mirrors fillLocationDropdown):
 *  1. Wait INITIAL_DELAY ms for Salesforce to finish rendering.
 *  2. Attempt to fill every pending field.
 *  3. Use a MutationObserver for any fields whose options aren't ready yet,
 *     retrying on each DOM mutation until MAX_WAIT_MS has elapsed.
 */
function autofillMyProfile() {
  // ── URL guard ────────────────────────────────────────────────────────────
  if (!window.location.href.includes(MY_PROFILE_URL_FRAGMENT)) {
    console.warn(
      "[Flee Autofill] URL does not include '" + MY_PROFILE_URL_FRAGMENT +
      "'. My Profile autofill skipped."
    );
    return;
  }

  console.log("[Flee Autofill] My Profile page detected — starting dropdown fill…");

  const INITIAL_DELAY = 1000;   // ms to wait before first attempt
  const MAX_WAIT_MS   = 8000;   // total ms before giving up

  setTimeout(() => {
    // Track which field indices still need to be resolved.
    const pending = new Set(MY_PROFILE_FIELDS.map((_, i) => i));

    /**
     * Attempts to fill every pending dropdown.
     * Removes successfully filled indices from `pending`.
     * @returns {boolean} true when all fields have been filled.
     */
    function tryFillAll() {
      for (const i of [...pending]) {
        const field = MY_PROFILE_FIELDS[i];
        if (tryFillSelect(field.labelKeywords, field.optionText)) {
          console.log(
            `[Flee Autofill] "${field.name}" → "${field.optionText}"`
          );
          pending.delete(i);
        }
      }
      return pending.size === 0;
    }

    // ── First attempt after initial delay ────────────────────────────────
    if (tryFillAll()) {
      console.log("[Flee Autofill] All My Profile dropdowns filled.");
      return;
    }

    // ── MutationObserver fallback for remaining fields ────────────────────
    const remaining = [...pending].map((i) => MY_PROFILE_FIELDS[i].name);
    console.log(
      "[Flee Autofill] Waiting for DOM updates to fill:",
      remaining.join(", ")
    );

    const deadline = Date.now() + (MAX_WAIT_MS - INITIAL_DELAY);

    const observer = new MutationObserver(() => {
      if (Date.now() > deadline) {
        observer.disconnect();
        const stillPending = [...pending].map((i) => MY_PROFILE_FIELDS[i].name);
        console.error(
          "[Flee Autofill] Timed out. Could not fill:",
          stillPending.join(", ")
        );
        return;
      }

      if (tryFillAll()) {
        observer.disconnect();
        console.log("[Flee Autofill] All My Profile dropdowns filled.");
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }, INITIAL_DELAY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Domestic Demographics page autofill  (pageId=Domestic_Demographics)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fills a plain text / date input by label, placeholder, name, or id.
 *
 * Builds a normalised fingerprint for each <input> or <textarea> on the page
 * and checks whether any of the provided keywords appear in it.
 * Skips the field if it already has a value.
 *
 * @param {string[]} keywords    Lowercase substrings to test against.
 * @param {string}   value       Value to write.
 * @param {boolean}  [overwrite] If true, fill even when a value already exists.
 * @returns {boolean} true when a matching field was found and filled.
 */
function tryFillInput(keywords, value, overwrite = false) {
  for (const el of document.querySelectorAll("input, textarea")) {
    // Skip non-visible / submit / button / hidden / checkbox / radio inputs.
    const type = normalize(el.type);
    if (["submit", "button", "hidden", "checkbox", "radio", "file"].includes(type)) continue;

    // Skip already-filled fields unless the caller requests an overwrite.
    if (!overwrite && el.value && el.value.trim() !== "") continue;

    const fingerprint = [
      getLabelText(el),
      normalize(el.placeholder),
      normalize(el.name),
      normalize(el.id),
      getNearbyText(el),
    ].join(" ");

    if (keywords.some((kw) => fingerprint.includes(normalize(kw)))) {
      fillInput(el, value);
      return true;
    }
  }
  return false;
}

/**
 * Autofills the Domestic Demographics form.
 *
 * Fields filled (and only these):
 *   - Country (address)           → "United States"
 *   - Address Line 1              → generateUSAddress()
 *   - Address Line 2              → left empty
 *   - City                        → generateCity()
 *   - State / Province            → generateState()
 *   - Zip Code                    → generateZip()
 *   - Is this your mailing addr?  → "Yes"
 *   - Social Security Number      → generateSSN()
 *   - Country of Citizenship      → "United States of America"
 *   - Date of Birth               → "09/02/2005"
 *   - Country of Birth            → "United States of America"
 *   - Gender                      → "Male/Man"
 */
function autofillDomesticDemographics() {
  // ── URL guard ────────────────────────────────────────────────────────────
  if (!window.location.href.includes(DOMESTIC_DEMOGRAPHICS_URL_FRAGMENT)) {
    console.warn(
      "[Flee Autofill] URL does not include '" +
        DOMESTIC_DEMOGRAPHICS_URL_FRAGMENT +
        "'. Domestic Demographics autofill skipped."
    );
    return;
  }

  console.log(
    "[Flee Autofill] Domestic Demographics page detected — waiting for form…"
  );

  /**
   * Polls the DOM every 300 ms until at least 10 input/select elements exist,
   * then resolves.  This ensures Salesforce has finished rendering the form
   * before we attempt to fill any fields.
   * @returns {Promise<void>}
   */
  function waitForInputs() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const inputs = document.querySelectorAll("input, select");
        if (inputs.length > 10) {
          clearInterval(interval);
          resolve();
        }
      }, 300);
    });
  }

  (async () => {
    await waitForInputs();
    console.log("[Flee Autofill] Form ready — starting fill…");

    // ── Generate random data ─────────────────────────────────────────────
    const address = generateUSAddress();
    const city    = generateCity();
    const state   = generateState();
    const zip     = generateZip();
    const ssn     = generateSSN();

    console.log("[Flee Autofill] Domestic Demographics data:", {
      address, city, state, zip, ssn,
    });

    // ── Helpers ──────────────────────────────────────────────────────────
    function fillSelectField(fieldName, keywords, optionText) {
      const ok = tryFillSelect(keywords, optionText);
      if (ok) {
        console.log(`[Flee Autofill] "${fieldName}" → "${optionText}"`);
      } else {
        console.warn(`[Flee Autofill] Could not fill "${fieldName}" (option: "${optionText}")`);
      }
    }

    function fillTextField(fieldName, keywords, value, overwrite = false) {
      const ok = tryFillInput(keywords, value, overwrite);
      if (ok) {
        console.log(`[Flee Autofill] "${fieldName}" → "${value}"`);
      } else {
        console.warn(`[Flee Autofill] Could not fill "${fieldName}"`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Address section
    // ─────────────────────────────────────────────────────────────────────

    fillSelectField("Country",
      ["mailing country", "address country", "country of residence", "country"],
      "United States"
    );

    fillTextField("Address Line 1",
      ["address line 1", "address1", "street address", "address line1", "line 1"],
      address
    );

    // Address Line 2 — intentionally left empty (skip).

    fillTextField("City", ["city"], city);

    // State / Province
    // Salesforce replaces the State text field with a <select> picklist once
    // Country is chosen.  We scan every select for one labelled "state" /
    // "province" and loop its options looking for a match on either the
    // visible text OR the option value (state abbreviation).
    (() => {
      const stateKeywords = ["state", "province", "state/province", "state / province"];
      for (const select of document.querySelectorAll("select")) {
        const fingerprint = [
          getLabelText(select),
          getNearbyText(select),
          normalize(select.name),
          normalize(select.id),
        ].join(" ");
        if (!stateKeywords.some((kw) => fingerprint.includes(normalize(kw)))) continue;

        for (const option of select.options) {
          if (
            normalize(option.textContent).includes(normalize(state)) ||
            normalize(option.value) === normalize(state)
          ) {
            select.value = option.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            console.log(`[Flee Autofill] "State/Province" → "${state}"`);
            return;
          }
        }
      }
      // Fallback: text input (non-Salesforce or shadow DOM)
      const stateInput = findInputDeep(stateKeywords);
      if (stateInput) {
        stateInput.value = state;
        stateInput.dispatchEvent(new Event("input",  { bubbles: true }));
        stateInput.dispatchEvent(new Event("change", { bubbles: true }));
        stateInput.dispatchEvent(new Event("blur",   { bubbles: true }));
        console.log(`[Flee Autofill] "State/Province" → "${state}"`);
      } else {
        console.warn("[Flee Autofill] Could not fill \"State/Province\"");
      }
    })();

    fillTextField("Zip Code",
      ["zip", "postal", "zip code", "postal code"],
      zip
    );

    fillSelectField("Is this your Mailing Address?",
      ["mailing address", "also your mailing", "same as mailing"],
      "Yes"
    );

    // ─────────────────────────────────────────────────────────────────────
    // Personal Information section
    // ─────────────────────────────────────────────────────────────────────

    // Social Security Number
    // Find the input via shadow-DOM-aware search, then set the value and fire
    // input / change / blur so Salesforce registers it as user-entered.
    (() => {
      const ssnInput = findInputDeep(["social security", "ssn"]);
      if (ssnInput) {
        ssnInput.value = ssn;
        ssnInput.dispatchEvent(new Event("input",  { bubbles: true }));
        ssnInput.dispatchEvent(new Event("change", { bubbles: true }));
        ssnInput.dispatchEvent(new Event("blur",   { bubbles: true }));
        console.log(`[Flee Autofill] "Social Security Number" → "${ssn}"`);
      } else {
        console.warn("[Flee Autofill] Could not find Social Security Number field.");
      }
    })();

    fillSelectField("Country of Citizenship",
      ["citizenship", "country of citizenship"],
      "United States of America"
    );

    fillTextField("Date of Birth",
      ["date of birth", "dob", "birth date", "birthdate"],
      "09/02/2005",
      true
    );

    fillSelectField("Country of Birth",
      ["country of birth", "birth country", "birthcountry"],
      "United States of America"
    );

    fillSelectField("Gender",
      ["gender", "sex"],
      "Male/Man"
    );

    console.log("[Flee Autofill] Domestic Demographics fill complete.");
  })();
}

// ─────────────────────────────────────────────
// Message listener (triggered by icon click)
// ─────────────────────────────────────────────

/**
 * Routes to the correct autofill routine based on the current page URL.
 *
 * - pageId=Domestic_Demographics → autofillDomesticDemographics()
 * - pageId=My_Profile            → autofillMyProfile()
 * - pageId=Registration          → autofill()
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === "runAutofill") {
    const url = window.location.href;

    if (url.includes(DOMESTIC_DEMOGRAPHICS_URL_FRAGMENT)) {
      autofillDomesticDemographics(); // async — Demographics form
    } else if (url.includes(MY_PROFILE_URL_FRAGMENT)) {
      autofillMyProfile();            // async — My Profile dropdowns
    } else {
      autofill();                     // sync  — Registration form fields
    }

    sendResponse({ success: true });
  }
});
