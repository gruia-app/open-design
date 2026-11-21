import type { SeoShowcase } from '../../types';

export const showcase: SeoShowcase = {
  locale: 'en',
  title: 'OpenDesign Showcase: Open-Source Design Assets',
  description:
    'Browse real design systems, templates, skills, plugins and craft rules shipped in the open-source OpenDesign repository. Free to read, reuse and extend.',
  ogTitle: 'OpenDesign Showcase: Open-Source Design Assets',
  ogDescription:
    'Design systems, templates, skills, plugins and craft rules from the open-source OpenDesign repository. Each entry links to its folder on GitHub.',
  keywords: [
    'open source design systems',
    'DESIGN.md examples',
    'free design templates',
    'open source design tool',
    'design system templates',
    'AI design skills',
    'open source prototyping templates',
    'collaborative design assets',
  ],
  eyebrow: 'Showcase',
  h1: 'What ships in the OpenDesign repository',
  lede:
    'A tour of the design systems, templates, skills, plugins and craft rules you can read, reuse and change today.',
  intro: [
    'Most of OpenDesign lives in files, not in framework code. A design system is a folder with a DESIGN.md. A template is a folder with a SKILL.md and an example. This page picks a few entries from each group and links to the real folders on GitHub. The repository holds many more than we list here.',
    'Some design systems are inspired by well-known products. They describe the visual language of a public website: color, type, spacing and mood. They are references for study and for starting points. They are not official brand kits, and the brands do not endorse them. If you ship a product, adapt the tokens to your own identity.',
    'Everything below is plain text and static HTML. You can open it in an editor, review it in a pull request and share it with your team. Nothing here is a mock-up of a feature that does not exist. If an entry is on this page, its folder is in the repository.',
  ],
  groups: [
    {
      id: 'design-systems',
      heading: 'Design systems',
      intro:
        'Each design system is a folder with a DESIGN.md, a manifest and CSS tokens. Agents and people read the same files. The entries below are inspired by public products and style families. Treat them as references, not as official brand kits.',
      items: [
        {
          name: 'Linear (inspired)',
          description:
            'Dark-first product design on a near-black canvas, with hairline borders and one restrained purple accent. Information density comes from small steps in luminance.',
          path: 'design-systems/linear-app',
          tags: ['dark mode', 'SaaS', 'minimal'],
        },
        {
          name: 'Stripe (inspired)',
          description:
            'A clean white canvas with deep navy headings and a saturated violet accent. Light type weights give it a calm, technical feel with some warmth.',
          path: 'design-systems/stripe',
          tags: ['fintech', 'light', 'gradients'],
        },
        {
          name: 'Vercel (inspired)',
          description:
            'Mostly white pages with near-black text and the Geist type family. The restraint is the point: structure first, decoration almost never.',
          path: 'design-systems/vercel',
          tags: ['developer tools', 'monochrome', 'minimal'],
        },
        {
          name: 'Notion (inspired)',
          description:
            'Warm neutrals instead of cold grays, serif headings and soft surfaces. The result reads like good paper rather than a glass screen.',
          path: 'design-systems/notion',
          tags: ['workspace', 'warm', 'serif'],
        },
        {
          name: 'GitHub (inspired)',
          description:
            'Dense rectangular panes with hairline borders, in light and dark. Built for people who scan lists, diffs and pull requests all day.',
          path: 'design-systems/github',
          tags: ['developer tools', 'dense', 'light and dark'],
        },
        {
          name: 'Figma (inspired)',
          description:
            'A marketing look built on a variable font with fine weight steps. Hierarchy comes from small weight differences, with bright color used for play.',
          path: 'design-systems/figma',
          tags: ['design tools', 'variable font', 'colorful'],
        },
        {
          name: 'Supabase (inspired)',
          description:
            'Dark, code-editor atmosphere with deep black surfaces and an emerald green accent. Typography is a geometric sans with rounded terminals.',
          path: 'design-systems/supabase',
          tags: ['dark mode', 'developer tools', 'green'],
        },
        {
          name: 'Raycast (inspired)',
          description:
            'An almost-black, blue-tinted canvas with layered shadows borrowed from desktop window chrome. It feels like a fast native utility.',
          path: 'design-systems/raycast',
          tags: ['dark mode', 'desktop feel', 'gradients'],
        },
        {
          name: 'Mintlify (inspired)',
          description:
            'A white, airy documentation look with near-black text and one green accent. Everything serves legibility and long reading sessions.',
          path: 'design-systems/mintlify',
          tags: ['documentation', 'light', 'readable'],
        },
        {
          name: 'PostHog (inspired)',
          description:
            'A sage-tinted cream background with earthy greens and an irreverent, handmade tone. It avoids the usual blue and purple of analytics tools.',
          path: 'design-systems/posthog',
          tags: ['analytics', 'playful', 'warm'],
        },
        {
          name: 'Sentry (inspired)',
          description:
            'Deep purple-black dashboards with pink and purple accents and one lime highlight. Dense, data-heavy and made for late-night debugging.',
          path: 'design-systems/sentry',
          tags: ['dashboard', 'dark mode', 'data-dense'],
        },
        {
          name: 'Cursor (inspired)',
          description:
            'A warm off-white canvas with brown-black text, soft cream surfaces and borders that fade into transparent overlays. Minimal, with a craft feel.',
          path: 'design-systems/cursor',
          tags: ['warm', 'editor', 'minimal'],
        },
        {
          name: 'Neobrutalism',
          description:
            'A style family, not a brand. Bold borders, vivid yellow and blue accents and high-contrast layouts on warm surfaces.',
          path: 'design-systems/neobrutalism',
          tags: ['bold', 'high contrast', 'style family'],
        },
        {
          name: 'Editorial',
          description:
            'A style family built on magazine layouts: refined serif type, structured grids and calm reading rhythm. Black and off-white at its core.',
          path: 'design-systems/editorial',
          tags: ['serif', 'grid', 'style family'],
        },
      ],
    },
    {
      id: 'design-templates',
      heading: 'Design templates',
      intro:
        'A design template is a packaged shape for one kind of artifact. Each folder has a SKILL.md and a hand-built example. The agent applies the active design system to it.',
      items: [
        {
          name: 'SaaS landing page',
          description:
            'A single-page landing with hero, features, social proof, pricing and a closing call to action. It follows the active design system tokens.',
          path: 'design-templates/saas-landing',
          tags: ['web', 'marketing', 'landing'],
        },
        {
          name: 'Pricing page',
          description:
            'Header, plan tiers, a feature comparison table and an FAQ on one page. Use it when the brief says plans, tiers or compare plans.',
          path: 'design-templates/pricing-page',
          tags: ['web', 'pricing', 'tables'],
        },
        {
          name: 'Documentation page',
          description:
            'Navigation on one side, a scrollable article in the middle and a table of contents on the other side. Good for guides and API references.',
          path: 'design-templates/docs-page',
          tags: ['web', 'docs', 'reading'],
        },
        {
          name: 'Dashboard',
          description:
            'An admin or analytics screen in a single HTML file: fixed sidebar, top bar, KPI cards and one or two charts.',
          path: 'design-templates/dashboard',
          tags: ['product UI', 'analytics', 'charts'],
        },
        {
          name: 'Kanban board',
          description:
            'A task board with To do, In progress, In review and Done columns, assignee avatars, swimlanes and a filter bar.',
          path: 'design-templates/kanban-board',
          tags: ['product UI', 'tasks', 'boards'],
        },
        {
          name: 'Mobile onboarding',
          description:
            'Three phone frames side by side: splash, value proposition and sign-in. It includes a status bar, swipe dots and a primary button.',
          path: 'design-templates/mobile-onboarding',
          tags: ['mobile', 'flows', 'onboarding'],
        },
        {
          name: 'Hand-drawn wireframe',
          description:
            'A wireframe in marker and pencil tone on graph paper, with tabs for variants and sticky-note annotations. It reads like a whiteboard before any pixels exist.',
          path: 'design-templates/wireframe-sketch',
          tags: ['wireframe', 'exploration', 'sketch'],
        },
        {
          name: 'Blog post',
          description:
            'A long-form article with masthead, hero image block, figures, pull quotes, author byline and related posts.',
          path: 'design-templates/blog-post',
          tags: ['content', 'editorial', 'web'],
        },
        {
          name: 'Marketing email',
          description:
            'A product-launch email in a centered single column with a table fallback. It has a wordmark masthead, hero block, headline, button and specifications grid.',
          path: 'design-templates/email-marketing',
          tags: ['email', 'marketing', 'HTML'],
        },
        {
          name: 'General web prototype',
          description:
            'The default for desktop pages when no more specific template fits. It starts from a seed HTML file and a library of section layouts.',
          path: 'design-templates/web-prototype',
          tags: ['prototype', 'web', 'default'],
        },
        {
          name: 'Pitch deck',
          description:
            'A fundraising deck template with a sample story about hook, traction, moat and the ask. Use it as a starting structure for your own slides.',
          path: 'design-templates/html-ppt-pitch-deck',
          tags: ['deck', 'slides', 'pitch'],
        },
      ],
    },
    {
      id: 'skills',
      heading: 'Skills',
      intro:
        'Skills are functional capabilities that agents call in the middle of a task. They do work on your input: write a brief, audit a screen, extract a brand. Each skill is a folder with a SKILL.md.',
      items: [
        {
          name: 'DESIGN.md manager',
          description:
            'Creates and manages DESIGN.md files, so design direction, tokens and visual rules live in one source of truth.',
          path: 'skills/design-md',
          tags: ['DESIGN.md', 'tokens', 'docs'],
        },
        {
          name: 'Design brief parser',
          description:
            'Turns a structured brief into a concrete spec. It asks for explicit palette, typography, layout, mood, density and constraints instead of "make it professional".',
          path: 'skills/design-brief',
          tags: ['brief', 'spec', 'planning'],
        },
        {
          name: 'Design review',
          description:
            'A visual audit that fixes what it finds, with atomic commits and before and after screenshots. Useful for tightening a screen before launch.',
          path: 'skills/design-review',
          tags: ['review', 'QA', 'screenshots'],
        },
        {
          name: 'Plan design review',
          description:
            'Rates each design dimension from 0 to 10, explains what a 10 looks like and flags signs of generic AI output. Works well as a gate before merging UI work.',
          path: 'skills/plan-design-review',
          tags: ['review', 'scoring', 'quality'],
        },
        {
          name: 'Design consultation',
          description:
            'Builds a design system from scratch, with creative risks and realistic product mockups. Suited to kickoff workshops and brand-from-zero work.',
          path: 'skills/design-consultation',
          tags: ['design system', 'workshop', 'brand'],
        },
        {
          name: 'Brand extract',
          description:
            'Pulls a brand kit from a live website by driving the in-app browser: colors, fonts and logo.',
          path: 'skills/brand-extract',
          tags: ['brand', 'browser', 'tokens'],
        },
        {
          name: 'Reference design contract',
          description:
            'Turns screenshots, URLs and "make it feel like this" notes into a grounded DESIGN.md plus an implementation handoff.',
          path: 'skills/reference-design-contract',
          tags: ['references', 'DESIGN.md', 'handoff'],
        },
        {
          name: 'Web design guidelines',
          description:
            'Reviews UI code against web interface guidelines for layout, typography, color, motion and accessibility.',
          path: 'skills/web-design-guidelines',
          tags: ['audit', 'accessibility', 'UI code'],
        },
        {
          name: 'Color expert',
          description:
            'A color science reference covering OKLCH, palette generation, contrast, color naming and the history of color theory.',
          path: 'skills/color-expert',
          tags: ['color', 'OKLCH', 'contrast'],
        },
      ],
    },
    {
      id: 'plugins',
      heading: 'Plugins',
      intro:
        'Plugins are the official building blocks that connect the stages of a design run. Each one is a small folder with a SKILL.md and a manifest.',
      items: [
        {
          name: 'Design extract',
          description:
            'Extracts color, typography and spacing tokens from imported code, screenshots or Figma exports into one canonical token bag.',
          path: 'plugins/_official/atoms/design-extract',
          tags: ['tokens', 'import', 'extract'],
        },
        {
          name: 'Token map',
          description:
            'Maps an extracted token bag onto the active design system. The result is a deterministic crosswalk that later stages can use.',
          path: 'plugins/_official/atoms/token-map',
          tags: ['tokens', 'mapping', 'design system'],
        },
        {
          name: 'Figma extract',
          description:
            'Pulls a Figma file node tree, design tokens and embedded assets into the project folder as a structured snapshot.',
          path: 'plugins/_official/atoms/figma-extract',
          tags: ['Figma', 'import', 'assets'],
        },
        {
          name: 'Critique theater',
          description:
            'A five-dimension review panel that scores an artifact on craft, brand, accessibility and copy, then drives fixes.',
          path: 'plugins/_official/atoms/critique-theater',
          tags: ['critique', 'scoring', 'review'],
        },
        {
          name: 'Diff review',
          description:
            'Shows the accumulated patch as a reviewable diff and stores the accept or reject decision in the artifact manifest.',
          path: 'plugins/_official/atoms/diff-review',
          tags: ['review', 'diff', 'approval'],
        },
        {
          name: 'Handoff',
          description:
            'Pushes the accepted artifact to a downstream surface such as the CLI, another code agent, GitHub or Figma, and records the export target.',
          path: 'plugins/_official/atoms/handoff',
          tags: ['export', 'handoff', 'collaboration'],
        },
      ],
    },
    {
      id: 'craft',
      heading: 'Craft rules',
      intro:
        'Craft files are brand-agnostic rulebooks. The design system decides how things look. A craft file decides which rules a screen must clear before it ships.',
      items: [
        {
          name: 'Accessibility baseline',
          description:
            'The accessibility floor every artifact must clear, plus commitments that go beyond it. It cites WCAG 2.2 and related standards.',
          path: 'craft/accessibility-baseline.md',
          tags: ['accessibility', 'WCAG', 'baseline'],
        },
        {
          name: 'State coverage',
          description:
            'Lists which states every interactive surface must render. It targets the common failure of showing only the populated state.',
          path: 'craft/state-coverage.md',
          tags: ['states', 'UX', 'checklist'],
        },
        {
          name: 'Typography',
          description:
            'Universal rules for how type behaves at every size, applied on top of whichever fonts the design system picks.',
          path: 'craft/typography.md',
          tags: ['type', 'scale', 'rules'],
        },
        {
          name: 'Laws of UX',
          description:
            'Cognitive and perceptual heuristics that shape composition: how many pricing tiers fit, where the main action sits and why settings need grouping.',
          path: 'craft/laws-of-ux.md',
          tags: ['UX', 'heuristics', 'layout'],
        },
        {
          name: 'Anti-AI-slop',
          description:
            'Concrete, checkable rules that separate shipped product design from default model output. Some are enforced by an automatic linter.',
          path: 'craft/anti-ai-slop.md',
          tags: ['quality', 'lint', 'AI output'],
        },
        {
          name: 'RTL and bidirectional text',
          description:
            'Rules for right-to-left layout and for lines that mix text directions, for products that serve Arabic, Hebrew or Persian readers.',
          path: 'craft/rtl-and-bidi.md',
          tags: ['RTL', 'i18n', 'layout'],
        },
      ],
    },
  ],
  sections: [
    {
      heading: 'How a team can use these assets',
      paragraphs: [
        'You do not need to adopt everything. Most teams start with one design system and one template, then add skills as they need them. Because every asset is a text file, the usual team habits work: branches, pull requests and code review.',
        'A designer can edit a DESIGN.md and see the effect on the next prototype. A product manager can read the same file and check that copy and layout follow the rules. An engineer can read tokens.css and reuse the same values in code.',
      ],
      steps: [
        'Pick the design system closest to your product, or start from the default one.',
        'Copy the folder, rename it and replace colors, type and rules with your own.',
        'Open a pull request so the team reviews the DESIGN.md like any other change.',
        'Choose a template that matches the artifact, such as a landing page or a dashboard.',
        'Run a prototype, then use a review skill to score it against your rules.',
        'Merge the result and keep the design system folder as the shared source of truth.',
      ],
    },
    {
      heading: 'How the catalogue is organised',
      paragraphs: [
        'The repository separates assets by what they do. Keeping the groups apart makes each one easier to find and to review.',
      ],
      table: {
        caption: 'Asset types in the OpenDesign repository',
        columns: ['Asset', 'Folder', 'What it holds', 'Answers the question'],
        rows: [
          ['Design system', 'design-systems/', 'DESIGN.md, manifest and CSS tokens', 'How should it look?'],
          ['Design template', 'design-templates/', 'SKILL.md and an example file', 'What kind of artifact is this?'],
          ['Skill', 'skills/', 'SKILL.md and optional resources', 'What work should the agent do?'],
          ['Plugin', 'plugins/', 'A manifest and a SKILL.md', 'How do the stages connect?'],
          ['Craft rules', 'craft/', 'Markdown rulebooks', 'What must a screen clear before it ships?'],
        ],
      },
      subsections: [
        {
          heading: 'Templates and skills are different',
          paragraphs: [
            'A design template renders one shape of artifact, such as a deck or a landing page. A skill does work on your input, such as auditing a screen or extracting a brand. If an entry mainly does work, it belongs in the skills folder.',
          ],
        },
        {
          heading: 'Counts change often',
          paragraphs: [
            'The repository holds more than 150 design systems, more than 110 design templates and more than 160 skills at the time of writing. Open the folders on GitHub for the current list.',
          ],
        },
      ],
    },
    {
      heading: 'How to contribute your own',
      paragraphs: [
        'The highest-value contributions are usually one folder or one Markdown file. The contributing guide in the repository explains the bar a pull request must clear. The skills guide covers how to write and test a skill.',
      ],
      steps: [
        'Fork the repository and create a branch for your asset.',
        'For a design system, add a folder under design-systems with a manifest.json, a DESIGN.md and a tokens.css file.',
        'For a skill or template, copy the closest existing folder and edit its SKILL.md.',
        'Check that the DESIGN.md has substantive sections and matches the values in tokens.css.',
        'Run the web app locally with pnpm tools-dev and try your asset on a real prompt.',
        'Open a pull request and fill every section of the template.',
      ],
      subsections: [
        {
          heading: 'What reviewers look for',
          bullets: [
            'The files are present, consistent and readable by both people and agents.',
            'The description is specific and does not copy marketing text.',
            'Brand-inspired systems say clearly that they are references and not official kits.',
            'The change is small enough to review in one sitting.',
          ],
        },
        {
          heading: 'Not sure where an idea fits?',
          paragraphs: [
            'Open an issue first. The maintainers will point you to the right folder. It is quicker than rewriting a pull request.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      question: 'Are these design systems official brand kits?',
      answer:
        'No. Systems named after known products are inspired by the public look of those products. They are references for study and for starting points. The brands do not endorse them, and you should adapt the tokens to your own identity before you ship.',
    },
    {
      question: 'Can I use these assets in a commercial project?',
      answer:
        'The OpenDesign repository uses the Apache-2.0 license. Read the license file and the notes inside each folder, because some entries credit third-party sources. For brand-inspired systems, do not copy logos or trademarks.',
    },
    {
      question: 'What is the difference between a skill and a design template?',
      answer:
        'A design template renders one kind of artifact, such as a deck or a landing page. A skill does work on your input, such as reviewing a screen or extracting a brand. Both use a SKILL.md file, but they live in separate folders.',
    },
    {
      question: 'How do I add my own design system?',
      answer:
        'Create a folder under design-systems with a manifest.json, a DESIGN.md and a tokens.css file. Keep the prose and the token values in sync. The design systems guide and the contributing guide in the repository list the full checklist.',
    },
    {
      question: 'Do I need to know how to code to use these assets?',
      answer:
        'No. You can browse the folders on GitHub and read the files as text. To use them inside OpenDesign, you pick a design system and a template in the app. Editing a DESIGN.md only needs a text editor.',
    },
    {
      question: 'What are craft rules?',
      answer:
        'Craft rules are brand-agnostic rulebooks on topics such as typography, color, accessibility and state coverage. A design system decides how a screen looks. A craft file decides which rules the screen must follow before it ships.',
    },
    {
      question: 'Is this the full list of assets?',
      answer:
        'No. This page shows a short selection from each group. The repository holds many more entries, and the numbers change as people contribute. Open the folders on GitHub to see everything.',
    },
    {
      question: 'Can a whole team share the same design system?',
      answer:
        'Yes. A design system is a folder in a repository, so a team can share it through Git. Everyone reviews changes in pull requests and works from the same files.',
    },
  ],
  cta: {
    heading: 'Open a folder and try one',
    body: 'Pick a design system and a template, then run them on a real brief. Everything is in the public repository, so you can read it before you install anything.',
    primaryLabel: 'Download OpenDesign',
    secondaryLabel: 'Browse the repository on GitHub',
  },
};
