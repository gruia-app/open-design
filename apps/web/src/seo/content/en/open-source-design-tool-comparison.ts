import type { SeoGuide } from '../../types';

export const guide: SeoGuide = {
  id: 'open-source-design-tool-comparison',
  locale: 'en',
  slug: 'open-source-design-tool-comparison',
  title: 'Open-Source Design Tool Comparison for Product Teams',
  description:
    'Compare open-source design tools for product teams: OpenDesign, Penpot, Figma and Claude Design. License, file format, agent support and self-hosting side by side.',
  ogTitle: 'How to choose an open-source design tool for your team',
  ogDescription:
    'A neutral comparison of OpenDesign, Penpot, Figma and Claude Design. Learn which criteria matter and when another tool is the better choice.',
  keywords: [
    'open source design tool',
    'open source figma alternative',
    'open source claude design alternative',
    'penpot vs figma',
    'penpot alternative',
    'self-hosted design tool',
    'design tool comparison',
    'ai design tool open source',
    'design tool for product teams',
  ],
  eyebrow: 'Guide',
  h1: 'Choosing an open-source design tool for a product team',
  lede:
    'Open-source design tools differ in what they treat as the source of truth: a canvas or code. This guide compares OpenDesign with Penpot, Figma and Claude Design on neutral criteria.',
  intro: [
    'Picking a design tool is a team decision, not a taste test. The tool shapes where your files live, who can open them, how engineers receive the work, and what happens if a vendor changes its terms. Open source does not answer all of these questions. It does answer some of them.',
    'This guide is written by the OpenDesign team, so we have a bias. We try to counter it with plain criteria and with an honest section on when another tool is the better choice. We only state facts about other tools that are widely known and stable. We leave out pricing and roadmaps, because both change.',
    'The guide starts with the question that matters most: is your design source a canvas or code? Then it gives two comparison tables, a short decision method, and notes on adopting a tool without a risky switch.',
  ],
  sections: [
    {
      heading: 'The one question that sorts the tools',
      paragraphs: [
        'Design tools fall into two camps. In the first camp, the source of truth is a canvas. People draw shapes, frames and components, and engineers rebuild them in code. In the second camp, the source of truth is code. An agent writes real HTML and CSS, and the design is the running page.',
        'Neither camp is better in general. Canvas tools suit exploration by hand and visual polish. Code-native tools suit fast, runnable prototypes and a short path to engineering. Many teams use both.',
      ],
      subsections: [
        {
          heading: 'Canvas-first tools',
          paragraphs: [
            'Figma and Penpot are canvas tools. Figma is a proprietary canvas SaaS. Penpot is open source and browser-based, and you can self-host it. Both let several people draw on one shared file.',
          ],
        },
        {
          heading: 'Code-native tools',
          paragraphs: [
            'OpenDesign and Claude Design are agent-native tools. You write a brief, and an agent produces artifacts such as prototypes, decks and dashboards. Claude Design is closed-source and cloud-only. OpenDesign is open source under the Apache 2.0 license and runs on your own machine or server.',
          ],
        },
      ],
    },
    {
      heading: 'Criteria that matter for a product team',
      paragraphs: [
        'List your criteria before you look at tools. The following list covers what most product teams care about. Rank them for your own context.',
      ],
      bullets: [
        'License: can you read, change and redistribute the code?',
        'Where files live: on your disk, on your server or on a vendor cloud?',
        'Output format: shapes in a proprietary file, or standard web files?',
        'Agent support: can the tool work with the coding agents your team already uses?',
        'Design-system format: how do you store tokens, components and brand rules?',
        'Self-hosting: can you run it inside your own network?',
        'Handoff: how much rework sits between the design and the shipped page?',
        'Collaboration: how do several people work in the same project?',
      ],
      subsections: [
        {
          heading: 'Why license is not enough',
          paragraphs: [
            'An open-source license gives you rights to the code. It does not by itself give you a good tool. Check that the project is active, that you can run it, and that your files stay portable.',
          ],
        },
        {
          heading: 'Why file location matters',
          paragraphs: [
            'Files on your own disk or server keep working when a vendor changes plans. They also pass security review more easily. If your legal team asks where design data lives, a local answer is short.',
          ],
        },
      ],
    },
    {
      heading: 'Comparison table 1: license, hosting and files',
      paragraphs: [
        'The table below covers the facts that are stable and easy to check. For other tools it lists only widely known properties.',
      ],
      table: {
        caption: 'License, hosting and file location',
        columns: ['Criterion', 'OpenDesign', 'Penpot', 'Figma', 'Claude Design'],
        rows: [
          ['License', 'Open source, Apache 2.0', 'Open source', 'Proprietary', 'Closed source'],
          [
            'Where files live',
            'On your machine or your own server, as project folders',
            'On a server you host or on the hosted service',
            'On the vendor cloud',
            'On the vendor cloud',
          ],
          [
            'Self-hosting',
            'Yes: desktop app, Docker, or run from source',
            'Yes',
            'No',
            'No',
          ],
          [
            'Runs in the browser',
            'Web UI served by the local daemon',
            'Yes',
            'Yes',
            'Cloud-hosted product',
          ],
          [
            'Main working surface',
            'Chat plus live preview of generated files',
            'Shared canvas',
            'Shared canvas',
            'Chat plus generated artifacts',
          ],
        ],
      },
      subsections: [
        {
          heading: 'How to read this table',
          paragraphs: [
            'Self-hosting is the sharpest line. If your policy requires design data to stay inside your network, Figma and Claude Design are out by definition. Penpot and OpenDesign remain.',
          ],
        },
        {
          heading: 'What the table does not say',
          paragraphs: [
            'The table does not rank quality. A closed tool can be excellent, and an open one can be a poor fit. Use the table to remove options, not to pick a winner.',
          ],
        },
      ],
    },
    {
      heading: 'Comparison table 2: output, agents and design systems',
      paragraphs: [
        'This table covers how each tool produces work and how it fits with coding agents. These points decide how much rework sits between design and engineering.',
      ],
      table: {
        caption: 'Output format, agent support and design-system format',
        columns: ['Criterion', 'OpenDesign', 'Penpot', 'Figma', 'Claude Design'],
        rows: [
          [
            'Output format',
            'HTML and CSS files; export to PDF, PPTX and MP4 for some artifact types',
            'Vector design files on a canvas',
            'Design files on a canvas',
            'Generated artifacts in the vendor product',
          ],
          [
            'Agent support',
            'Runs on the coding agent CLIs on your machine, or a key-based provider',
            'Not agent-native; reachable through its API and plugins',
            'Not agent-native; reachable through its API and plugins',
            'Anthropic models only',
          ],
          [
            'Design-system format',
            'A DESIGN.md file per brand, with optional tokens and components',
            'Libraries and components inside the design file',
            'Libraries, styles and components inside the design file',
            'Proprietary',
          ],
          [
            'Extensibility',
            'Skills, design templates, design systems and plugins as plain folders',
            'Plugins and API',
            'Plugins and API',
            'Closed',
          ],
          [
            'Handoff to code',
            'The artifact is already web code',
            'Inspect and rebuild in code',
            'Inspect and rebuild in code',
            'Export from the product',
          ],
        ],
      },
      subsections: [
        {
          heading: 'Output format and rework',
          paragraphs: [
            'A canvas file needs a rebuild in code. A generated HTML page needs a review and a port to your framework. Both cost time. They cost it in different places.',
          ],
        },
        {
          heading: 'Agent support',
          paragraphs: [
            'OpenDesign does not bundle an agent. It uses the CLI you already installed. Your team can switch the agent without switching the design tool. It also ships an MCP server, so an agent in another repository can read the live project files.',
          ],
        },
      ],
    },
    {
      heading: 'Where OpenDesign fits',
      paragraphs: [
        'OpenDesign is an open-source alternative to Claude Design. It keeps the same loop: discover the brief, lock the direction, stream the artifact, critique, deliver. It removes the lock-in. You choose the agent, you keep the files, and you can self-host.',
        'It is also a code-native partner for canvas tools. A team can keep Figma or Penpot for detailed visual work and use OpenDesign for runnable prototypes, decks and dashboards. We do not ask you to drop your canvas tool.',
      ],
      subsections: [
        {
          heading: 'As an alternative to Claude Design',
          bullets: [
            'Open source under the Apache 2.0 license.',
            'Works with many coding agent CLIs, not one model family.',
            'Runs as a desktop app for macOS and Windows, with Docker as another route.',
            'Reads a DESIGN.md brand file on every render.',
          ],
        },
        {
          heading: 'As a complement to Figma and Penpot',
          bullets: [
            'Generate a first working prototype from a brief in minutes, then refine details on the canvas.',
            'Use dedicated plugins to migrate Figma or Pencil work into React, Next.js or Vue code.',
            'Export decks to PPTX and PDF without redrawing slides.',
          ],
        },
      ],
    },
    {
      heading: 'When another tool is the better choice',
      paragraphs: [
        'No tool fits every team. Here are cases where we would point you elsewhere.',
      ],
      subsections: [
        {
          heading: 'Choose Penpot when you want an open-source canvas',
          paragraphs: [
            'If your designers work by hand on a shared canvas and you need open source with self-hosting, Penpot is the natural choice. OpenDesign is not a canvas. It does not replace direct manipulation of vector shapes.',
          ],
        },
        {
          heading: 'Choose Figma when the ecosystem is the point',
          paragraphs: [
            'If your agency, your clients and your plugins already live in Figma, switching has a high cost. A proprietary SaaS is a fair trade if you value its ecosystem and do not need self-hosting.',
          ],
        },
        {
          heading: 'Choose Claude Design when you want a managed product',
          paragraphs: [
            'If you want a hosted product with no setup, and you accept a closed source and one model family, a managed tool is simpler. OpenDesign asks you to set up a runtime and an agent.',
          ],
        },
        {
          heading: 'Stay with your current tool when it works',
          paragraphs: [
            'A tool your team uses well beats a better tool nobody learns. Switch when a concrete problem pushes you, such as data residency, vendor lock-in or slow handoff.',
          ],
        },
      ],
    },
    {
      heading: 'A short method to choose',
      paragraphs: [
        'Use this method for a decision that takes a week, not a quarter.',
      ],
      steps: [
        'Write down your hard constraints, such as self-hosting, license or data location.',
        'Remove every tool that fails a hard constraint.',
        'Pick one real project from your backlog, with a real brief.',
        'Run that project in the two or three remaining tools.',
        'Compare the time to a first reviewable result and the rework before handoff.',
        'Ask the engineer who receives the work which output they prefer.',
        'Decide, and write down the reason so the team remembers it.',
      ],
      subsections: [
        {
          heading: 'Measure rework, not demos',
          paragraphs: [
            'A demo shows the best case. A real brief shows the average case. Count how many messages or edits you need before the engineer can start.',
          ],
        },
        {
          heading: 'Plan an exit',
          paragraphs: [
            'Ask how you leave the tool before you enter it. Plain files on your disk are the easiest exit. Check that you can open and move your work without the vendor.',
          ],
        },
      ],
    },
    {
      heading: 'Adopting a tool without a risky switch',
      paragraphs: [
        'You do not need to move the whole team on one day. Start with one project and one small group.',
      ],
      bullets: [
        'Pilot on a low-risk project, such as an internal tool or a landing page.',
        'Keep your canvas tool for work that needs it.',
        'Put your brand in a DESIGN.md file so the pilot looks like your product.',
        'Review the output with an engineer in the first week.',
        'Write a one-page note on what worked and what did not.',
      ],
    },
  ],
  faq: [
    {
      question: 'What is the best open-source design tool for a product team?',
      answer:
        'It depends on your source of truth. Penpot is a strong choice if you want an open-source canvas. OpenDesign is a strong choice if you want agents to generate runnable prototypes, decks and dashboards from briefs. Many teams use both.',
    },
    {
      question: 'Is OpenDesign an open-source alternative to Claude Design?',
      answer:
        'Yes. OpenDesign follows the same loop of brief, direction, artifact, critique and delivery. It is open source under the Apache 2.0 license, works with many coding agent CLIs, and runs on your own machine or server.',
    },
    {
      question: 'Can OpenDesign replace Figma?',
      answer:
        'It can replace some Figma work, such as first prototypes and decks, but it is not a canvas. It generates real HTML and CSS instead of shapes on a frame. Teams that draw by hand will still want a canvas tool next to it.',
    },
    {
      question: 'How is OpenDesign different from Penpot?',
      answer:
        'Penpot is an open-source canvas where people draw designs. OpenDesign is an agent-native tool where a coding agent writes the design as web files. Both are open source and both can run on your own infrastructure.',
    },
    {
      question: 'Can I self-host an open-source design tool?',
      answer:
        'Yes. Penpot and OpenDesign both support self-hosting. OpenDesign runs as a desktop app, through Docker, or from source. Check each project documentation for the exact setup.',
    },
    {
      question: 'Which design tool works with coding agents like Claude Code or Codex?',
      answer:
        'OpenDesign works with local coding agent CLIs, including Claude Code and Codex, and it offers a key-based provider for teams without a CLI. It also ships an MCP server so agents in other repositories can read project files.',
    },
    {
      question: 'Do I need to give up my design system to try OpenDesign?',
      answer:
        'No. You describe your brand in a DESIGN.md file, and the agent reads it on each render. You can create the file by hand or let the agent draft it from a screenshot or a URL. Your existing system in another tool stays as it is.',
    },
  ],
  cta: {
    heading: 'Try it on one real brief',
    body: 'Download OpenDesign and run one project from your backlog. It is open source, it runs on your machine, and you keep every file. If it does not fit, you lose an afternoon.',
    primaryLabel: 'Download OpenDesign',
    secondaryLabel: 'View the source on GitHub',
  },
};
