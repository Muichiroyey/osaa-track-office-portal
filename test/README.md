# Office Portal UI harness

Runs the **real** Office Portal bundle inside `jsdom`, against the **real**
backend and the **real** MySQL database — React effects run, `fetch` is
live, and every assertion reads only what React actually rendered into
`#root`.

It exists because this environment has no browser available. It is not a
replacement for clicking through the app yourself; it's a fast regression
check that the pages mount, the API contracts still match, and the
office-scoping rules still hold. Assumes the database is at its pristine
seeded state (a fresh import of `database/schema.sql`).

## Running it

With MySQL running, the backend on `:5000`, and `npm run build` done:

```
cd "office portal"
npm install --no-save jsdom@24     # test-only dependency
node test/build-bundle.mjs         # bundles as IIFE — jsdom has no ES module loader
node test/ui-harness.mjs
```

## What it checks

- The office sign-in renders, with no account-type picker and no
  registration path (unlike the shared Student & Alumni Portal page)
- The Demo Office account signs in and lands on its own dashboard
- Every spec module appears in navigation
- Document Queue's "My Requests" tab shows this office's own tickets
  (including an `awaiting_submission` one, explained rather than left as
  a raw status) and not a ticket that belongs to someone else
- The "E-Signature Requests" tab shows the request routed to this office
  and offers a way to sign it
- Campus Feed shows the composer and the office's own seeded post
- Student Endorsement's Received/Sent tabs show the right seeded
  endorsement in each
- Document Repository shows this office's own folder and not SAA's
- Student Leaders Directory offers to register an organization when none
  is claimed yet
- Announcements, FAQ, Notifications, and Settings all render
- SAA Chat loads a thread for this office

This is a template you can extend — e.g. actually submitting a new
request, signing and confirming a route end to end, or posting to Campus
Feed and reloading to confirm it stuck.


## `ui-new-features.mjs` — the revision round

Checks the newer behaviour (floating FAQ box, real author names on Campus Feed,
photo picker / Settings logo / Student Leaders branding, chat photos). Unlike
`ui-harness.mjs` it does **not** need a pristine database; point it at any
running backend:

```
node test/build-bundle.mjs
BACKEND=http://localhost:5000 OFFICE_EMAIL=... OFFICE_PASSWORD=... node test/ui-new-features.mjs
```
