# demo-profile-service

**This is a fixture, not a real service.** It exists so `project-review` has
something with known defects to run against — it is the README's worked example
and the regression fixture CI asserts on.

Every flaw in here is deliberate. The credential in `src/client.js` is a
made-up string, not a live key. Do not deploy this, do not copy patterns from
it, and do not "fix" it: `examples/expected-review.json` is pinned to this
source, and editing a line shifts every anchor in it.

## What it pretends to be

A small profile service: stores a user profile, looks it up by id, and enriches
it from a third-party geo API.

```
src/server.js    express wiring
src/routes.js    the two handlers
src/db.js        sqlite access
src/client.js    third-party geo lookup
src/log.js       request logging
src/validate.js  the validation helpers, partly unused
test/validate.test.js
```

## Running it

You cannot, without installing dependencies — which is itself part of the
fixture. `node_modules/` is absent on purpose, so a review of this repo has to
exercise the "suite exists but cannot run" path and report `not-run` with a
bootstrap command rather than installing anything.
