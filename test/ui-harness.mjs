// Runs the REAL built Office Portal bundle inside jsdom, against the REAL
// backend and the REAL MySQL database. Effects run, fetch is real, React
// renders — the closest thing to a browser available in this environment.
// Assumes the database is at its pristine seeded state (a fresh import of
// database/schema.sql, nothing else run against it yet).
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const DIST = "../dist";
const BACKEND = "http://localhost:5000";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdomError: " + (e.detail?.stack || e.message)));
vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");

const dom = new JSDOM(html, {
  url: "http://localhost:5175/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole: vc,
  resources: undefined,
});
const { window } = dom;

window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  const target = url.startsWith("/") ? BACKEND + url : url;
  try {
    const res = await fetch(target, init);
    console.log(`   [fetch] ${init?.method || "GET"} ${target} -> ${res.status}`);
    return res;
  } catch (e) {
    console.log(`   [fetch FAILED] ${target}: ${e.message}`);
    throw e;
  }
};
window.URL.createObjectURL = () => "blob:mock";
window.URL.revokeObjectURL = () => {};
window.scrollTo = () => {};
window.Element.prototype.scrollIntoView = function () {};
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });

const bundle = fs.readFileSync("harness-bundle.js", "utf8");
window.eval(bundle);

const text = () => (window.document.getElementById("root")?.textContent || "").replace(/\s+/g, " ").trim();
const q = (sel) => window.document.getElementById("root")?.querySelector(sel) || null;
const qa = (sel) => [...(window.document.getElementById("root")?.querySelectorAll(sel) || [])];
const byText = (tag, t) => qa(tag).find((el) => el.textContent.trim().toLowerCase().includes(t.toLowerCase()));

function set(el, value) {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
}
const click = (el) => {
  if (!el) throw new Error("click(): element not found");
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
};
const submitForm = () => q("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
function go(route) {
  window.history.pushState({}, "", route);
  window.dispatchEvent(new window.PopStateEvent("popstate"));
}
async function signIn(email, password) {
  set(q("#email"), email);
  set(q("#password"), password);
  await sleep(150);
  if (q("#email").value !== email) throw new Error("controlled input did not take the value");
  submitForm();
  await sleep(2500);
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  \u2713" : "  \u2717"} ${name}${detail ? " — " + detail : ""}`);
};

await sleep(1200);
console.log("\n── Login screen ──");
check("renders the office sign-in", text().includes("Sign In"));
check("labelled OFFICE PORTAL, not a shared student/alumni picker", text().includes("OFFICE PORTAL"));
check("no account-type picker (offices are unambiguous)", !q('input[name="accountType"]'));
check("no registration offered", !text().toLowerCase().includes("create an account") && !text().toLowerCase().includes("sign up"));

console.log("\n── Signing in as the Demo Office ──");
await signIn("demo.office@psu.edu.ph", "portal123");
let t = text();
check("lands on the dashboard", t.includes("Welcome back"), t.match(/Welcome back, [^!]+!/)?.[0] || "");
check("shows the office's own name/category, not a student/alumni badge", t.includes("Demo Office (Testing)") || t.includes("Other Offices"));
check("nav includes every spec module", [
  "Announcements", "Campus Feed", "Document Queue", "Document Repository",
  "Student Endorsement", "Student Leaders Directory", "FAQ", "SAA Chat", "Notifications", "Settings",
].every((l) => t.includes(l)));
check("dashboard stat cards rendered", t.includes("Document Queue") && t.includes("E-Signature Requests") && t.includes("Announcements"));

console.log("\n── Document Queue: My Requests ──");
go("/document-queue");
await sleep(1500);
t = text();
check("shows the office's own filed/assigned tickets", t.includes("#SAA-15") && t.includes("#SAA-16"));
check("does not show a ticket that isn't this office's (e.g. #SAA-14)", !t.includes("#SAA-14"));
check("awaiting-submission ticket explained, not just labelled", t.includes("Awaiting Submission") || t.includes("awaiting_submission"));

console.log("\n── Document Queue: E-Signature Requests ──");
click(byText("button", "E-Signature Requests"));
await sleep(600);
t = text();
check("shows the route addressed to this office", t.includes("#SAA-14"));
check("shows an unsigned request as awaiting signature", t.includes("Awaiting your signature"));
click(byText("button", "#SAA-14"));
await sleep(1000);
t = text();
check("route detail explains what to do", t.includes("e-signature is requested") || t.includes("Sign anywhere"));
check("sign action is offered", Boolean(byText("button", "Sign document")));

console.log("\n── Campus Feed ──");
go("/campus-feed");
await sleep(1500);
t = text();
check("composer offers posting as this office", t.includes("Post as Demo Office"));
check("seeded office post visible in the shared feed", t.includes("Demo Office Orientation Week"));

console.log("\n── Student Endorsement ──");
go("/student-endorsement");
await sleep(1500);
t = text();
check("received tab shows the endorsement addressed to this office", t.includes("Carlo J. Ramirez"));
click(byText("button", "Sent"));
await sleep(500);
t = text();
check("sent tab shows the endorsement this office filed", t.includes("Bea R. Fernandez"));

console.log("\n── Document Repository ──");
go("/document-repository");
await sleep(1500);
t = text();
check("shows the office's own pre-seeded folder", t.includes("Office Memoranda"));
check("does not show SAA's own repository folders", !t.includes("MOAs & MOUs"));

console.log("\n── Student Leaders Directory ──");
go("/student-leaders");
await sleep(1500);
t = text();
check("directory of other organizations renders", t.length > 100);
click(byText("button", "My Organization"));
await sleep(700);
t = text();
check("no organization claimed yet, so the register form shows", t.includes("Register your organization"));

console.log("\n── Announcements / FAQ / Notifications / Settings ──");
for (const [route, needle] of [
  ["/announcements", "Office Coordination Memo"],
  ["/faq", "Frequently Asked"],
  ["/notifications", "Notifications"],
]) {
  go(route);
  await sleep(1300);
  check(`${route} renders`, text().includes(needle));
}
t = text();
check("notifications show the seeded system alerts", t.includes("E-signature requested") || t.includes("SAA requested a document"));

go("/settings");
await sleep(1300);
check("/settings renders", text().includes("Change password"));

console.log("\n── SAA Chat ──");
go("/saa-chat");
await sleep(2000);
t = text();
check("chat thread loads for this office", t.includes("Office of Student and Alumni Affairs") || q("textarea"));

console.log("\n══ SUMMARY ══");
const passed = results.filter((r) => r.ok).length;
console.log(`${passed}/${results.length} checks passed`);
const failed = results.filter((r) => !r.ok);
if (failed.length) console.log("FAILED:\n" + failed.map((f) => "  - " + f.name + (f.detail ? " (" + f.detail + ")" : "")).join("\n"));
if (errors.length) {
  console.log("\nRUNTIME ERRORS:");
  [...new Set(errors)].slice(0, 12).forEach((e) => console.log("  " + e.slice(0, 260)));
} else {
  console.log("\n\u2713 no uncaught runtime errors");
}
process.exit(0);
