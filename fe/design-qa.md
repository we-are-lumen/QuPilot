# QuPilot Sculpted Coral Console - Design QA

## Evidence

- Reference: `design-reference-sculpted-coral-console.png`
- Desktop render: `design-render-desktop.png`
- Mobile render: `design-render-mobile.png`
- Browser: Codex in-app browser at `http://localhost:3000`
- Viewports: 1440x1024 desktop and 390x844 mobile

## Fidelity Ledger

| Area | Reference evidence | Render evidence | Result |
| --- | --- | --- | --- |
| Palette | True-white canvas with coral clay accents | White canvas, `#e05d45` actions, pale coral molded surfaces | Passed |
| Hero hierarchy | Large two-line headline with coral second line | Matching headline hierarchy and copy, responsive mobile wrapping | Passed |
| Hero asset | Provider-to-reward sculpted workflow | Dedicated clay mission-flow asset placed beside the headline | Passed |
| Material | Rounded matte modules with soft dual shadows and inset highlights | Shared clay surface, icon, input, and button primitives across routes | Passed |
| Product data | Dashboard remains structured and readable | Existing DB-backed stats, quest cards, tables, forms, and statuses preserved | Passed |
| Navigation | Minimal white header with coral primary action | Landing, user, and provider shells share the same header material | Passed |
| Responsive behavior | Desktop-first concept | Mobile hero, CTA stack, asset continuation, and auth modal fit without overflow | Passed |

## Copy Diff

The approved hero copy is present: `Coordinate quests. Let agents execute.`,
`Explore Quests`, and `Become a Provider`. Existing QuPilot navigation and
product copy remain where required by the real application.

## Interaction Check

- Landing navigation and CTA links are exposed with valid destinations.
- Connect Wallet opens the clay-styled role selection modal.
- Modal controls remain selectable and the primary action remains enabled.
- No browser runtime errors were observed.

## Intentional Deviations

- The live app keeps its existing top-level routes and DB-backed quest content
  instead of reproducing the mock dashboard's invented rows.
- Existing semantic green and amber remain for success and reward readability.
- The provider dashboard keeps its current header-led shell rather than adding
  a new sidebar that would change the established navigation contract.

final result: passed
