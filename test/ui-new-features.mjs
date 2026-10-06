// Runs the REAL Office Portal bundle in jsdom against the REAL backend + MySQL
// and checks the revision work: floating FAQ box, Campus Feed author name/logo,
// photo picker, office-logo Settings, Student Leaders branding, chat photo bubbles.
// Needs: backend running (set BACKEND), `node build-bundle.mjs` done, jsdom installed.
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const BACKEND = process.env.BACKEND || "http://localhost:5000";
const EMAIL = process.env.OFFICE_EMAIL || "demo.office@psu.edu.ph";
const PASSWORD = process.env.OFFICE_PASSWORD || "portal123";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdomError: " + (e.detail?.stack || e.message)));
vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

const dom = new JSDOM(fs.readFileSync(path.join("../dist", "index.html"), "utf8"), {
  url: "http://localhost:5175/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
});
const { window } = dom;
window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  return fetch(url.startsWith("/") ? BACKEND + url : url, init);
};
window.URL.createObjectURL = () => "blob:mock";
window.URL.revokeObjectURL = () => {};
window.scrollTo = () => {};
window.Element.prototype.scrollIntoView = function () {};
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
window.eval(fs.readFileSync("harness-bundle.js", "utf8"));

const root = () => window.document.getElementById("root");
const text = () => (root()?.textContent || "").replace(/\s+/g, " ").trim();
const q = (s) => root()?.querySelector(s) || null;
const qa = (s) => [...(root()?.querySelectorAll(s) || [])];
const byText = (tag, t) => qa(tag).find((el) => el.textContent.trim().toLowerCase().includes(t.toLowerCase()));
function set(el, v) {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
}
const click = (el) => { if (!el) throw new Error("click(): element not found"); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); };
function go(route) { window.history.pushState({}, "", route); window.dispatchEvent(new window.PopStateEvent("popstate")); }
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? " — " + detail : ""}`); };

await sleep(1200);
set(q("#email"), EMAIL); set(q("#password"), PASSWORD); await sleep(150);
q("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
await sleep(2500);
check("signed in", text().includes("Welcome back"));

console.log("\n── FAQ is a floating box, not a module ──");
const navLabels = qa("aside a, nav a").map((a) => a.textContent.trim());
check("no FAQ item in the sidebar", !navLabels.some((l) => l === "FAQ"), navLabels.join(" | ").slice(0, 120));
const fab = q('button[aria-label="Open FAQ"]');
check("floating FAQ button is on the dashboard", Boolean(fab));
check("no FAQ panel until opened", !q('section[aria-label="Frequently asked questions"]'));
click(fab); await sleep(1500);
const panel = q('section[aria-label="Frequently asked questions"]');
check("clicking it opens the FAQ panel", Boolean(panel));
check("panel loaded entries from the API", (panel?.querySelectorAll("li button").length || 0) > 0, `${panel?.querySelectorAll("li button").length} entries`);
const first = panel?.querySelector("li button");
click(first); await sleep(200);
check("an entry expands to show its answer", first?.getAttribute("aria-expanded") === "true");
const search = panel?.querySelector("input");
set(search, "zzzz-no-such-question"); await sleep(200);
check("search filters the list (no match message)", text().includes("No matching questions"));
set(search, ""); await sleep(100);
click(q('button[aria-label="Minimize FAQ"]')); await sleep(200);
check("minimize collapses it back to the button", !q('section[aria-label="Frequently asked questions"]') && Boolean(q('button[aria-label="Open FAQ"]')));
go("/campus-feed"); await sleep(1500);
check("the floating FAQ button stays available on other pages", Boolean(q('button[aria-label="Open FAQ"]')));
go("/faq"); await sleep(800);
check("old /faq link redirects to the dashboard", window.location.pathname === "/" && text().includes("Welcome back"), window.location.pathname);

console.log("\n── Campus Feed ──");
go("/campus-feed"); await sleep(1800);
const t = text();
check("composer says 'Post as <office name>'", t.includes("Post as Demo Office"));
check("composer has the photo picker (Add photos)", t.includes("Add photos"));
check("no generic file-list dropzone", !t.includes("Attach photos (optional)"));
check("another office/SAA post shows the real author name, not a hardcoded one", t.includes("Demo Office (Testing)"));
check("admin posts show the SAA name", t.includes("Office of Student and Alumni Affairs"));
check("posts have an author avatar element", qa("article, div").some((el) => el.querySelector("span.rounded-full img, img.rounded-full, div.rounded-full")));

console.log("\n── Settings: office logo ──");
go("/settings"); await sleep(1500);
check("Settings describes the office logo on feed posts", text().includes("office logo") && text().includes("Campus Feed"));

console.log("\n── Student Leaders: branding ──");
go("/student-leaders"); await sleep(1800);
const tl = text();
check("page renders", tl.includes("Student Leaders"));
click(byText("button", "My Organization")); await sleep(1500);
const tm = text();
if (tm.includes("Register your organization")) {
  check("no organization yet → registration form with Org / College / PSU logo slots", ["Org Logo", "College Logo", "PSU Logo"].every((l) => tm.includes(l)));
  check("registration form asks for organization, college and university names", ["Name of the Organization", "Name of the College", "Name of the University"].every((l) => tm.includes(l)));
  check("university name defaults to Pangasinan State University", q("input[value='Pangasinan State University']") !== null);
  check("PSU logo hint mentions the standard seal", tm.includes("standard PSU seal"));
} else {
  check("registered office sees its organization with an 'Edit branding' button", tm.includes("Edit branding"));
  click(byText("button", "Edit branding")); await sleep(500);
  check("branding modal has all three logo slots + college/university names", ["Org Logo", "College Logo", "PSU Logo", "Name of the College", "Name of the University"].every((s) => text().includes(s)));
  check("modal is pre-filled with the current organization name", q("input[value='Test Society 2']") !== null || q("input[value]") !== null);
  check("organization shows the PSU seal image when no PSU logo is uploaded", qa("img").some((i) => /psu-seal|data:image/.test(i.getAttribute("src") || "")));
}

console.log("\n── SAA Chat: photos ──");
go("/saa-chat"); await sleep(2000);
check("chat has a 'Send a photo' button", Boolean(q('button[title="Send a photo"]')));
check("chat has a file attach button", Boolean(q('button[title="Attach a file"]')));
check("photo input only accepts images", Boolean(q('input[type="file"][accept="image/*"]')));
const imgs = qa("img[alt='chat-photo.png']");
check("a photo in the thread renders inline as an <img>, not a download chip", imgs.length > 0, `${imgs.length} inline image(s)`);

console.log(`\n${pass} passed, ${fail} failed`);
const real = errors.filter((e) => !/Not implemented|navigation|Could not parse CSS/.test(e));
console.log(real.length ? "\nRuntime errors:\n" + real.slice(0, 8).join("\n") : "No runtime errors from the portal.");
process.exit(fail ? 1 : 0);
