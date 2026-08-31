# Unused files

- app.js.unused (originally src/app.js) — a small global auth-state listener. No HTML file
  references it, so it never actually runs. Kept here in case it was meant to be wired in later;
  rename back to app.js and add a <script type="module" src="/src/app.js"> tag to whichever
  page(s) should use it, or just delete it if it's not needed.
