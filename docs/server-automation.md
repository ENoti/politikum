# Server-driven turns and UI choices

`MatchAutomation` advances active matches every 500 ms, even with no browsers open. It invokes the Java engine for bot turns and outstanding response/deferred effects. Idle polling does not increment the persisted version. Each match has a separate transaction; the conditional update rejects an obsolete state or metadata snapshot. Finished, killed and lobby matches are excluded.

Browser `tick` and `tickBot` commands now return `server_driven_move`. Explicit player choices still use the normal authenticated move API. No database migration is required. Deploy frontend and backend together because the updated frontend consumes `G.choices`.

Configuration defaults:

- `politikum.automation.enabled=true`
- `politikum.automation.initial-delay-ms=1000`
- `politikum.automation.delay-ms=500`

`G.choices` provides coalition targets, hand action flags, persona 16 discard count and persona 34 guess options. It is computed **after** viewer-specific privacy filtering and never stored in engine state. Guesses must not depend on the secret deck or other players' hidden hands. The engine still validates every submitted move; these hints do not replace validation.

`GameOverOverlay` and `TokenPips` are separate presentation components. The result overlay uses the server's winner. ActionBoard no longer elects a browser to drive the game. It still contains substantial UI state, placement selectors, keyboard handling and some eligibility checks; this change does not claim that every UI predicate has been eliminated.

Regression coverage includes automatic bot turns, response expiry, idle polling, stopped games, stale snapshot rejection, viewer privacy and action hints. Existing HTTP and browser smoke tests remain in CI.

## Reaction presentation

`G.choices.reactions` selects eligible response card IDs and advertises persona 8/10 reactions. The panel, hand and shortcuts consume the same server decisions, including the persona 33 cancellation restriction. Persona 8 targets require both coalition cards to exist. `G.choices.actions.persona39RecycleSelf` controls its shortcut.

Shortcut `1` submits one response: card 6, card 8, card 14, then persona 10, in that order of availability. It no longer submits two moves when both cards 6 and 14 are held. The panel offers explicit card 14 and persona 8 buttons; a persona 8 response no longer requires holding card 8. Duplicate central hints were removed so they cannot cover the response controls.

UI hints stay visible until the server closes the response, rather than trusting the browser's clock. Actual move validation and expiry remain in the Java engine. Projection and shortcut regression tests run in the existing CI checks.
