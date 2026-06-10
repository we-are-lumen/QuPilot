# Clay Lifecycle Medallions

## Goal

Redesign the landing page's four-step quest lifecycle so each step has a
distinct claymorphism icon medallion. The section should feel more memorable
and tactile without reducing the clarity of the existing quest flow.

## Approved Direction

Use the approved **Clay Icon Medallions** concept:

- one large clay medallion centered in each step card;
- a unique metaphor for each step;
- the existing four-step order and product meaning remain unchanged;
- coral, blue, amber, and green continue to identify the four stages;
- content remains code-native and accessible.

The visual companion concept at
`.superpowers/brainstorm/37572-1781111896/content/clay-step-icons.html` is the
composition reference. The generated brainstorming directory is ignored and is
not a production dependency.

## Card Anatomy

Each card contains:

1. the existing numbered stage label;
2. the existing step title;
3. a centered 96px clay medallion;
4. concise supporting product detail below the medallion.

The medallion uses a softly tinted stage color, a raised dual shadow, inset
highlight and shade, a subtle dashed orbit, and a production-quality SVG icon.
Icons must use balanced geometry and remain readable at mobile sizes.

## Icon Metaphors

- **Quest:** coral rocket or mission token representing a funded quest.
- **Dispatch:** blue robot capsule with a green online status dot.
- **Execute:** amber transaction block with a verification path or check.
- **Claim:** green SOL reward coin using the existing Solana visual language.

The icons should feel like one family: similar optical size, rounded geometry,
solid fills, and consistent shadow depth.

## Content

Keep the current step labels and titles:

- `QUEST` / `Quest Published`
- `DISPATCH` / `Agent Dispatched`
- `EXECUTE` / `On-Chain Steps`
- `CLAIM` / `SOL Reward Claimed`

Preserve live pooled reward data in the claim step. Existing execution meaning,
including swap and CLMM steps, must remain represented. Supporting copy may be
shortened only where necessary to make the icon the focal point.

## Layout

- Desktop at `lg` and above: four equal cards in one horizontal flow with the
  existing dashed connectors.
- Tablet: a two-by-two grid without cross-row connectors.
- Mobile: a single vertical stack with no horizontal overflow.
- Card heights should align on desktop even when supporting copy differs.
- The containing clay surface and section heading remain unchanged.

## Motion

- Cards retain their existing entrance reveal.
- Medallions may float vertically by 3-5px on a slow loop.
- Orbit or status accents may animate subtly.
- Motion must stop or reduce when `prefers-reduced-motion` is enabled.
- No large rotations, bouncing cards, or distracting continuous connector
  animation.

## Implementation Boundaries

- Scope changes to the lifecycle components in `fe/app/page.tsx` and, only if
  useful for shared material primitives, `fe/app/globals.css`.
- Do not add raster assets or new dependencies.
- Do not alter APIs, live statistics, auth behavior, quest data mapping, or
  other landing sections.
- Prefer a focused reusable medallion component rather than four unrelated
  blocks of styling.

## Accessibility

- Decorative SVGs use `aria-hidden="true"`.
- Text continues to communicate every lifecycle stage without relying on icon
  or color alone.
- Contrast remains sufficient for labels and supporting copy.
- Reduced-motion users receive a stable layout.

## Verification

- Run targeted ESLint on `app/page.tsx`.
- Run the production build.
- Verify the section in the in-app browser at desktop and `390x844`.
- Confirm no horizontal overflow, clipping, framework overlay, or new console
  errors.
- Compare the rendered section with the approved Clay Icon Medallions concept
  for icon prominence, card balance, palette, spacing, and responsive behavior.
