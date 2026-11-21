import type { SeoGuide } from '../../types';

export const guide: SeoGuide = {
  id: 'design-systems-as-code',
  locale: 'en',
  slug: 'design-systems-as-code',
  title: 'Design Systems as Code: Brand Rules in DESIGN.md Files',
  description:
    'Write your brand design system as a DESIGN.md file with tokens, keep it in git, review it like code and let AI agents follow it. A guide for OpenDesign users.',
  ogTitle: 'Design systems as code: a brand in a DESIGN.md file',
  ogDescription:
    'How to structure a DESIGN.md design system, bind tokens in CSS, version it in git and migrate from a static style guide, with OpenDesign.',
  keywords: [
    'design system as code',
    'DESIGN.md',
    'design tokens CSS',
    'design system for AI agents',
    'version design system in git',
    'brand guidelines to design system',
    'style guide to design system',
    'open source design system',
  ],
  eyebrow: 'Guide',
  h1: 'Design systems as code with DESIGN.md',
  lede:
    'A static style guide describes a brand to a person. A DESIGN.md package describes it to a person and to an agent, and git keeps it honest.',
  intro: [
    'Most brand guidelines live in a PDF or a slide deck. People read them once, then copy values by hand. An AI agent cannot do much with a PDF of screenshots, and neither can a build tool.',
    'OpenDesign stores a design system as a small package of files. The main file is DESIGN.md, which explains the brand in plain prose. A companion tokens.css file holds the same decisions as CSS custom properties. A manifest describes the package. The agent reads these files whenever a project uses the system.',
    'This guide shows how those packages are built, how agents consume them and how a team versions, reviews and migrates them. It stays close to what the repository documents. Where we are not sure, we say so.',
  ],
  sections: [
    {
      heading: 'What a design system package contains',
      paragraphs: [
        'In OpenDesign, a design system is a package, not a single Markdown file. The repository documents a minimum shape of three files in one folder. The folder name is a short lowercase slug.',
      ],
      bullets: [
        'manifest.json holds discovery metadata: the id, the name, the category, a short description and the source of the package.',
        'DESIGN.md holds the canonical design prose for agents.',
        'tokens.css holds the canonical compiled CSS custom properties.',
      ],
      subsections: [
        {
          heading: 'The three required files',
          table: {
            caption: 'Minimum files in a design system package',
            columns: ['File', 'Audience', 'Purpose'],
            rows: [
              ['manifest.json', 'The app and the guards', 'Lists the id, name, category, description, source and declared files'],
              ['DESIGN.md', 'People and agents', 'Explains intent, roles, rules and anti-patterns in prose'],
              ['tokens.css', 'Agents and build tools', 'Binds the same decisions to CSS variables'],
            ],
          },
        },
        {
          heading: 'Optional files for a richer package',
          paragraphs: [
            'A package can also declare more files. They give the agent more to work with, and they give reviewers something to run.',
          ],
          bullets: [
            'USAGE.md: a short, agent-facing guide with a read order, highlights, dos and avoids.',
            'components.html: a standalone page that shows real components built from the tokens.',
            'components.manifest.json, design-tokens.json and tailwind-v4.css: derived files, regenerated from the sources.',
            'preview pages for colors, typography and spacing.',
            'assets and fonts for logos and webfonts.',
            'source files with importer evidence, when the package comes from a website or a repository.',
          ],
        },
        {
          heading: 'Legacy folders still work',
          paragraphs: [
            'The daemon still finds folders that contain only a DESIGN.md file. That path exists for older and user-installed content. For new work, write the full package.',
          ],
        },
      ],
    },
    {
      heading: 'How to write DESIGN.md',
      paragraphs: [
        'DESIGN.md explains intent, decisions and usage to an agent. It is not a fixed template with numbered sections. The repository guard asks for at least seven substantive headings for a migrated package, and it does not dictate their titles or order.',
        'Use headings that describe your actual system. Avoid empty headings added only to reach a count.',
      ],
      subsections: [
        {
          heading: 'Topics most systems cover',
          bullets: [
            'Visual theme and atmosphere: the overall feel in a few sentences.',
            'Color roles and contrast intent: what each color is for, not only its value.',
            'Typography: families, scale, leading and tracking.',
            'Spacing, layout and composition.',
            'Components and interaction states.',
            'Motion behavior and reduced-motion handling.',
            'Accessibility expectations.',
            'Concrete anti-patterns: what the agent must never do.',
          ],
        },
        {
          heading: 'Write for roles, not for swatches',
          paragraphs: [
            'A list of hex values tells an agent very little. A role tells it when to use the value. Write that the accent color marks the primary action, and that body text uses the secondary text color. Then the agent can make good choices on pages you never described.',
            'Bundled examples such as design-systems/linear-app/DESIGN.md follow this pattern. They name each color, explain its job and list the traits that make the brand recognizable.',
          ],
        },
        {
          heading: 'Add provenance',
          paragraphs: [
            'If the system comes from a website or a style guide, say so in the file. A short note on the source helps reviewers judge how far to trust a value and when to refresh it.',
          ],
        },
      ],
    },
    {
      heading: 'Tokens: turning prose into CSS variables',
      paragraphs: [
        'tokens.css is the compiled token stylesheet. It lets an agent use exact values without translating prose. Shared declarations go in a root block.',
        'The token contract lives in the contracts package and is re-exported in the design-systems schema folder. The repository guard checks the required shared slots, default parity and an allowlist for extra tokens. A final tokens.css must contain every required slot. Brand-specific extensions follow the documented allowlist.',
      ],
      subsections: [
        {
          heading: 'Use semantic names',
          paragraphs: [
            'Component CSS should use semantic variables, such as a background, a foreground and an accent, instead of raw colors. Then a theme change touches the tokens and nothing else.',
            'When a system has a dark variant, override the semantic tokens under a theme selector. Do not copy whole component rules into a second block.',
          ],
        },
        {
          heading: 'Keep prose and tokens in sync',
          paragraphs: [
            'If DESIGN.md names an accent, a type scale, a spacing rhythm or a motion duration, tokens.css must express the same decision. The two files describe one system. When they disagree, the agent gets mixed signals.',
          ],
          table: {
            caption: 'What to change when a decision changes',
            columns: ['Decision', 'Edit in DESIGN.md', 'Edit in tokens.css'],
            rows: [
              ['New accent color', 'Update the color roles section', 'Change the accent variables'],
              ['New body font', 'Update the typography section', 'Change the font variables'],
              ['Tighter spacing', 'Update the spacing section', 'Change the spacing variables'],
              ['Shorter motion', 'Update the motion section', 'Change the duration variables'],
            ],
          },
        },
        {
          heading: 'Derived formats',
          paragraphs: [
            'A package can include Design Tokens JSON and a Tailwind v4 mapping. The documentation treats them as caches derived from tokens.css. Regenerate them. Do not edit them by hand, because they would compete with the source of truth.',
          ],
        },
      ],
    },
    {
      heading: 'How agents consume a design system',
      paragraphs: [
        'You do not paste the design system into a prompt. When a skill opts in to the active design system, the daemon composes the package into the system prompt for the run.',
      ],
      subsections: [
        {
          heading: 'The order of the context',
          paragraphs: [
            'The skills protocol documents the order in which material enters the prompt.',
          ],
          steps: [
            'Package guidance from USAGE.md, or a default usage contract.',
            'The complete DESIGN.md body.',
            'Import-mode guidance, when the package declares one.',
            'The tokens.css file.',
            'A compact component manifest, or components.html when no manifest exists.',
            'An index of rich files that the agent can pull on demand.',
            'Craft references that the skill requested.',
            'The body of the active skill or template.',
          ],
        },
        {
          heading: 'Craft rules sit beside the brand',
          paragraphs: [
            'The repository also keeps a craft folder with universal rules that hold for any brand, such as typography and color discipline. A skill opts in to the ones it needs. DESIGN.md tells the agent what is true for your brand. Craft tells it what is true for good UI in general.',
          ],
        },
        {
          heading: 'Media skills may skip it',
          paragraphs: [
            'Interface, deck and template skills commonly use the design system. Media skills commonly do not. A skill states its choice in its own front matter.',
          ],
        },
      ],
    },
    {
      heading: 'Versioning, review and ownership in git',
      paragraphs: [
        'Because a package is a folder of text files, git gives you history, branches and review for free. This is the main reason to treat a design system as code.',
      ],
      bullets: [
        'Every rule change is a commit with an author and a message.',
        'A pull request shows the DESIGN.md diff and the tokens.css diff together.',
        'A tag marks a release of the system that a product can pin.',
        'Revert is one command when a change goes wrong.',
        'Blame shows who decided a rule and when.',
      ],
      subsections: [
        {
          heading: 'A review checklist',
          table: {
            caption: 'Checklist for a design system pull request',
            columns: ['Check', 'Question to ask', 'Evidence'],
            rows: [
              ['Slug and id', 'Do the folder name and the manifest id match?', 'manifest.json'],
              ['Files present', 'Does every declared path exist?', 'Package folder'],
              ['Prose depth', 'Does DESIGN.md have at least seven substantive sections?', 'DESIGN.md headings'],
              ['Token parity', 'Do the tokens agree with the prose?', 'tokens.css and DESIGN.md'],
              ['Fixtures', 'Do the components use declared tokens and show focus states?', 'components.html'],
              ['Accessibility', 'Do text pairs meet the contrast targets?', 'Preview pages'],
              ['Repository guards', 'Do guard and typecheck pass for the repository?', 'CI output'],
            ],
          },
        },
        {
          heading: 'Name an owner',
          paragraphs: [
            'Assign one owner to each system. The owner approves changes and keeps the package consistent. In a small team, the design lead can hold this role.',
          ],
        },
        {
          heading: 'Accessibility checks to review',
          bullets: [
            'Normal text meets a 4.5 to 1 contrast ratio on its real background.',
            'Large text meets a 3 to 1 ratio.',
            'Every interactive control has a visible focus style.',
            'Reduced-motion overrides apply only to the elements that animate.',
          ],
        },
      ],
    },
    {
      heading: 'Creating a design system from brand references',
      paragraphs: [
        'You rarely start from nothing. A brand usually already exists as a website, a logo and a few screenshots. OpenDesign can help you turn those references into a first draft.',
      ],
      steps: [
        'Collect references: the website address, logo files, fonts and any existing guidelines.',
        'Open the Design System area in the app and start a new system from your references.',
        'Let the agent inspect the site. The repository includes a brand-extract skill that drives the in-app browser to pull colors, fonts and logo from a live website.',
        'Read the generated DESIGN.md. Correct the roles and delete anything that does not match your brand.',
        'Compare tokens.css with the prose and fix any mismatch.',
        'Preview the colors, typography and spacing pages and check contrast.',
        'Commit the package to your repository and open a pull request for review.',
      ],
      subsections: [
        {
          heading: 'Sources the repository supports',
          paragraphs: [
            'The manifest records where a package came from. The documented source types are bundled, local, GitHub and shadcn. This lets a reviewer see the origin of every system.',
          ],
        },
        {
          heading: 'Treat the draft as a draft',
          paragraphs: [
            'An extracted system captures what a site shows today. It does not capture intent. A person must add the rules about when to use each value and what to avoid. That is the part an agent cannot guess.',
          ],
        },
      ],
    },
    {
      heading: 'Migrating from a static style guide',
      paragraphs: [
        'A migration does not need to be a big project. Move the rules that matter most first and keep the old guide until the new package covers the same ground.',
      ],
      subsections: [
        {
          heading: 'A staged plan',
          steps: [
            'Inventory the old guide and list colors, type, spacing, components and voice.',
            'Create the package folder with a manifest, a DESIGN.md file and a tokens.css file.',
            'Move color and type rules first, as roles with reasons.',
            'Bind each decision to a token and check that prose and tokens agree.',
            'Add anti-patterns taken from real review comments.',
            'Run one real brief with the new system and compare the artifact with your current pages.',
            'Fix gaps, then retire the old guide or link it to the package.',
          ],
        },
        {
          heading: 'What changes for the team',
          table: {
            caption: 'Static style guide compared with a DESIGN.md package',
            columns: ['Aspect', 'Static style guide', 'DESIGN.md package'],
            rows: [
              ['Format', 'PDF, slides or a web page', 'Text files in a folder'],
              ['Reader', 'People', 'People, agents and build tools'],
              ['History', 'File names and memory', 'Git commits and tags'],
              ['Review', 'Meetings and comments', 'Pull requests'],
              ['Values', 'Copied by hand', 'Bound as CSS variables'],
              ['Drift', 'Found by accident', 'Found in a diff'],
            ],
          },
        },
        {
          heading: 'What does not change',
          paragraphs: [
            'Taste still matters. A package cannot replace a design lead. It only makes the lead decisions readable, repeatable and easy to review.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      question: 'What is a DESIGN.md file?',
      answer:
        'DESIGN.md is a Markdown file that explains a brand design system in prose: theme, color roles, typography, spacing, components, motion and anti-patterns. In OpenDesign, agents read it as part of the prompt. It sits next to a tokens.css file and a manifest in one package folder.',
    },
    {
      question: 'What does a design system as code mean?',
      answer:
        'It means the design rules live in text files that tools can read, instead of in a PDF. You version them in git, review them with pull requests and bind values to CSS variables. People and AI agents then work from the same source.',
    },
    {
      question: 'How do AI agents use a DESIGN.md file?',
      answer:
        'When a skill opts in, the daemon adds the package to the system prompt. It sends the usage guide, the DESIGN.md body, the tokens and a component index before the skill instructions. The agent then follows your colors, type and rules.',
    },
    {
      question: 'Do I need tokens.css as well as DESIGN.md?',
      answer:
        'For a new package, yes. DESIGN.md carries intent, and tokens.css carries exact values the agent can use directly. A DESIGN.md-only folder still works as a legacy format, but the repository does not recommend it for new content.',
    },
    {
      question: 'How do I version a design system in git?',
      answer:
        'Keep the package folder in a repository. Change DESIGN.md and tokens.css in the same commit, review them in a pull request and tag stable versions. Products can then pin a tag and upgrade on purpose.',
    },
    {
      question: 'Can I create a design system from an existing website?',
      answer:
        'Yes, as a starting point. The Design System area and the brand-extract skill can read colors, fonts and a logo from a live site. Review the draft and add the rules about usage, because a website shows values but not intent.',
    },
    {
      question: 'How is this different from design tokens alone?',
      answer:
        'Tokens give exact values, but they do not explain when to use them. DESIGN.md adds roles, rules and anti-patterns. Together they give an agent both the numbers and the reasoning.',
    },
    {
      question: 'Can I use the bundled design systems as a base?',
      answer:
        'Yes. The repository ships a large catalog of design systems, more than one hundred, in the design-systems folder. Read a few to see how they are written, then copy the closest one and adapt it to your brand. Check the origin and license of any system you reuse.',
    },
  ],
  cta: {
    heading: 'Turn your style guide into a package',
    body:
      'Download the app, open the Design System area and start from a bundled example or from your own website. The first draft takes minutes. The rules take longer, as they should.',
    primaryLabel: 'Download OpenDesign',
    secondaryLabel: 'Browse the design systems on GitHub',
  },
};
