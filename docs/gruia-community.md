# Gruia examples library

The managed Community screen starts with nine Spanish briefs: three B2B, three
landings and three games. Search and category filters work locally. “Usar prompt”
passes the brief to the existing Home composer as a prototype, where the user
chooses when to generate. It does not start a paid run automatically.

The briefs are original Gruia adaptations informed by the linked OpenDesign
examples. They are not represented as community submissions. Upstream plugin
cards and their existing actions remain available below the curated section.

Six examples can be opened directly through the authenticated studio:

| Local example | Origin | Purpose |
| --- | --- | --- |
| `opendesign-onboarding.html` | OpenDesign `plugins/_official/examples/mobile-onboarding/example.html` | Mobile onboarding reference |
| `opendesign-saas.html` | OpenDesign `plugins/_official/examples/saas-landing/example.html` | SaaS landing reference |
| `opendesign-gamified.html` | OpenDesign `plugins/_official/examples/gamified-app/example.html` | Gamified app reference |
| `fable-b2b-landing.html` | Original, generated with Claude Fable 5.1 | B2B demo landing |
| `roi-calculator.html` | Original, generated with Claude Sonnet | Interactive lead conversion calculator |
| `lead-quiz-game.html` | Original, generated with Claude Sonnet | Five-question qualification game |

Files live in `apps/web/public/gruia/examples/`. The three upstream plugin
manifests declare MIT; attribution and the permission notice are retained in
`NOTICE.txt`. External font links were removed so the previews are self-contained.
Original Gruia examples follow the fork's Apache-2.0 license. These examples use
fictitious data and do not send form data to an external service.

The model selector explicitly includes `claude-fable-5-1`, as documented in
[Anthropic's model overview](https://platform.claude.com/docs/en/models/fable-5-1/overview).
It runs through the server's existing Claude runtime. Adding this option does
not change the user's saved model preference.

Validation covers category/search filtering and prompt handoff, managed-only
visibility, the six previews at mobile width, the quiz's five questions/results/
restart flow, and calculator updates. A production Fable 5.1 run successfully
created the original landing with native model evidence in the run stream.
