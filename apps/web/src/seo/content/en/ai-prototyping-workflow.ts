import type { SeoGuide } from '../../types';

export const guide: SeoGuide = {
  id: 'ai-prototyping-workflow',
  locale: 'en',
  slug: 'ai-prototyping-workflow',
  title: 'AI Prototyping Workflow: From Brief to Prototype',
  description:
    'Learn an AI prototyping workflow with coding agents in OpenDesign: write the brief, lock the direction, review the output and hand off real HTML to engineers.',
  ogTitle: 'AI prototyping workflow: from brief to working prototype',
  ogDescription:
    'A practical loop for product teams: brief, direction, artifact, critique and delivery. Run it with the coding agent you already use, in open-source OpenDesign.',
  keywords: [
    'ai prototyping workflow',
    'ai prototype generator',
    'prototype with coding agents',
    'brief to prototype',
    'ai design to code handoff',
    'open source ai design tool',
    'generate html prototype with ai',
    'ai prototyping for product teams',
  ],
  eyebrow: 'Guide',
  h1: 'An AI prototyping workflow, from brief to working prototype',
  lede:
    'OpenDesign turns a written brief into a real HTML prototype with the coding agent already on your machine. This guide shows the loop and how a product team runs it.',
  intro: [
    'Most prototypes start as a vague message in a chat thread. Someone writes "we need a settings page for teams", and three people picture three different pages. An AI prototyping workflow fixes the order of work. You write the brief first. You agree on a direction second. Only then does the agent build.',
    'OpenDesign follows one loop: discover the brief, lock the direction, stream the artifact, critique it, and deliver it. The loop is not new. Good design teams already work this way. The difference is that a coding agent does the typing, and every step leaves a file you can open.',
    'This guide covers the full loop for product teams. It explains the artifact types, how to write a brief that works, how to iterate without losing the thread, and how to hand the result to engineering. It is a plain description of how we use the tool. It is not a promise of magic.',
  ],
  sections: [
    {
      heading: 'What an AI prototyping workflow is',
      paragraphs: [
        'An AI prototyping workflow is a fixed sequence of steps in which a coding agent builds the prototype and people steer it. The sequence matters more than the model. A team with a clear sequence gets repeatable results from almost any capable agent.',
        'OpenDesign does not ship its own agent. It uses the coding agent CLIs that already run on your computer, such as Claude Code, Codex, Cursor Agent, OpenCode, Qwen, GitHub Copilot CLI and others. If you have no CLI installed, you can configure a bring-your-own-key provider in Settings instead.',
      ],
      subsections: [
        {
          heading: 'Why a loop beats a single prompt',
          paragraphs: [
            'One long prompt hides decisions. The agent guesses the audience, the tone, the layout and the brand. Most of those guesses are wrong in small ways, and you pay for them later.',
            'A loop makes each decision visible. You answer questions before the build. You approve a direction before the first pixel. You review a critique before you ship. Each gate costs a minute and saves an hour.',
          ],
        },
        {
          heading: 'What stays under your control',
          bullets: [
            'The agent: you choose which installed CLI or key-based provider runs the work.',
            'The brand: a DESIGN.md file in the project describes colors, type and components.',
            'The files: the output is plain HTML and CSS in your project folder.',
            'The approval: nothing ships until a person accepts the result.',
          ],
        },
      ],
    },
    {
      heading: 'The five steps of the OpenDesign loop',
      paragraphs: [
        'The loop has five steps. Each step has one job and one output. Teams that skip a step usually come back to it later, at a higher price.',
      ],
      steps: [
        'Discover the brief. The agent asks short questions about audience, goal, platform and tone.',
        'Lock the direction. You pick a visual direction or bind an existing design system.',
        'Stream the artifact. The agent writes the files and the preview updates as they change.',
        'Critique. A review panel scores the artifact and the agent fixes what fails.',
        'Deliver. You export the result or hand the files to engineering.',
      ],
      subsections: [
        {
          heading: 'Step 1: discover the brief',
          paragraphs: [
            'The agent can ask clarifying questions in a form inside the chat. You answer them in one pass. The answers return to the agent as your next message, so nothing is lost.',
            'Keep the answers short and specific. "Operations managers at a logistics company, desktop, dense tables" is a good answer. "Everyone" is not.',
          ],
        },
        {
          heading: 'Step 2: lock the direction',
          paragraphs: [
            'If you have no brand, you can pick from a set of curated visual directions. If you have a brand, you bind a design system. A design system in OpenDesign is a folder with a DESIGN.md file that the agent reads on every render.',
            'Lock this step before you build. Changing the direction after the build costs more than changing it before.',
          ],
        },
        {
          heading: 'Steps 3 to 5: build, critique, deliver',
          paragraphs: [
            'The agent writes the files and the preview follows them. When the agent finishes an artifact, the built-in Design Jury can review it. Five reviewers score it: Designer, Critic, Brand, Accessibility and Copy.',
            'By default the review runs up to three rounds. The artifact ships when the composite score reaches 8.0 out of 10. If it does not, the run falls back to the best round. You then export or hand off the files.',
          ],
        },
      ],
    },
    {
      heading: 'What you can prototype',
      paragraphs: [
        'A new project starts from one of six creation tabs: Prototype, Live Artifact, Deck, Template, Media and Other. The tab sets the kind of project and the skills the agent uses.',
      ],
      table: {
        caption: 'Creation tabs in OpenDesign and what each one produces',
        columns: ['Creation tab', 'What it produces', 'Typical use'],
        rows: [
          [
            'Prototype',
            'Responsive web, mobile, tablet or desktop-app interfaces as HTML',
            'Landing pages, app screens, flows',
          ],
          [
            'Live Artifact',
            'High-fidelity artifacts with data and editable parameters',
            'Dashboards, KPI walls, decision rooms',
          ],
          [
            'Deck',
            'Multi-slide presentations with speaker notes',
            'Pitch decks, weekly reports, internal talks',
          ],
          [
            'Template',
            'A new project that starts from a template you saved',
            'Repeatable formats for your team',
          ],
          [
            'Media',
            'Images, video and audio through the providers you configure',
            'Visual assets and motion graphics',
          ],
          [
            'Other',
            'A free-form project with no required skill',
            'Documents and anything that fits nowhere else',
          ],
        ],
      },
      subsections: [
        {
          heading: 'Web, desktop and mobile prototypes',
          paragraphs: [
            'In the Prototype tab you choose one or more platform targets and a fidelity level. You can also pick a rendering template from the catalogue of design templates, such as a dashboard, a documentation page or a mobile app flow.',
            'The output is a real page in HTML and CSS. It renders in a sandboxed preview inside the app. You can open the files in any editor.',
          ],
        },
        {
          heading: 'Decks and dashboards',
          paragraphs: [
            'Decks use deck templates and support speaker notes. You review the slides as thumbnails and export when you are ready.',
            'Live artifacts expose a tweaks panel. The agent writes a manifest of the parameters worth changing, and the preview re-renders without a reload. This helps when a stakeholder wants to see the same dashboard with other numbers.',
          ],
        },
        {
          heading: 'Export formats',
          bullets: [
            'HTML: the native format of every prototype.',
            'PDF: for documents and decks that people read offline.',
            'PPTX: for decks that marketing or sales will edit in a slide tool.',
            'MP4: for motion graphics built with HyperFrames, which turns HTML into video.',
          ],
        },
      ],
    },
    {
      heading: 'How a product team runs the workflow',
      paragraphs: [
        'The loop works for one person. It works better when each role owns one gate. The roles below are a suggestion. Small teams will merge them.',
      ],
      table: {
        caption: 'Who owns each gate in a team run',
        columns: ['Step', 'Owner', 'Question the owner answers'],
        rows: [
          ['Brief', 'Product manager', 'Who is this for, and what must the user be able to do?'],
          ['Direction', 'Design lead', 'Which brand and which visual direction apply?'],
          ['Build', 'Coding agent', 'Does the artifact match the brief and the design system?'],
          ['Critique', 'Design lead and reviewers', 'Does the artifact pass the review, and do people agree?'],
          ['Handoff', 'Front-end engineer', 'Can I continue from these files without rework?'],
        ],
      },
      subsections: [
        {
          heading: 'A one-day prototype sprint',
          steps: [
            'Morning: the product manager writes the brief and the design lead binds the design system.',
            'Late morning: the agent builds the first version and the team reviews the preview together.',
            'Early afternoon: the team lists three changes and the agent applies them in one message.',
            'Mid afternoon: the Design Jury runs and the team fixes the items it marks as must-fix.',
            'End of day: the engineer receives the files and starts from real HTML.',
          ],
        },
        {
          heading: 'Keep the brand in one place',
          paragraphs: [
            'Put the brand in the DESIGN.md file, not in the prompt. Then every project, every person and every agent uses the same tokens. A new colour then changes in one file, not in twenty chats.',
          ],
        },
      ],
    },
    {
      heading: 'How to write a good brief',
      paragraphs: [
        'A good brief is short and concrete. It names a person, a task and a constraint. The agent then has fewer guesses to make.',
      ],
      bullets: [
        'Name the audience in one phrase, for example "finance leads at a mid-size company".',
        'State the one task the page must support.',
        'Name the platform: web, mobile, tablet or desktop app.',
        'List the content that must appear, such as a table, a chart or a pricing block.',
        'List what to avoid, such as stock photos or long forms.',
        'Add one reference, such as a screenshot or a URL, if you have one.',
      ],
      subsections: [
        {
          heading: 'A weak brief and a stronger one',
          paragraphs: [
            'Weak: "Make a dashboard for our product." The agent must invent the user, the data and the style.',
            'Stronger: "A weekly dashboard for support managers on desktop. Show open tickets by priority, median response time and a list of the ten oldest tickets. Use our design system. Keep it calm and dense."',
          ],
        },
        {
          heading: 'Use references, not adjectives',
          paragraphs: [
            'Words such as "modern" and "clean" mean different things to different people. A screenshot, a URL or an existing design system carries more information. If you have none, pick one of the curated directions and move on.',
          ],
        },
      ],
    },
    {
      heading: 'How to iterate without losing the thread',
      paragraphs: [
        'Iteration is where most prototypes go wrong. The team sends ten small requests, and the page drifts. A few habits keep the work on course.',
      ],
      bullets: [
        'Batch your feedback. Send one message with three to five changes, not five messages with one change.',
        'Point at the element. Say "the second card in the pricing row", not "that box".',
        'Change one layer at a time. Fix structure first, then copy, then colour.',
        'Use the tweaks panel for values. Do not ask the agent to retype a number.',
        'Keep a good version. Save a template when a project becomes a format you will reuse.',
      ],
      subsections: [
        {
          heading: 'When to restart',
          paragraphs: [
            'Restart when the direction is wrong, not when the details are wrong. If three rounds of feedback do not move the page toward the brief, the brief or the direction is the problem. Go back to step one or step two.',
          ],
        },
        {
          heading: 'What the critique adds',
          paragraphs: [
            'The Design Jury checks things people forget under time pressure: contrast, focus states, semantic structure, token use and error message copy. It does not replace a human review. It makes the human review shorter.',
          ],
        },
      ],
    },
    {
      heading: 'Hand off to engineering',
      paragraphs: [
        'The handoff is simple because the artifact is already code. There is no export from a canvas and no redline file to interpret.',
      ],
      steps: [
        'Open the project folder and check that the HTML, CSS and assets are there.',
        'Install the OpenDesign MCP server in the coding agent your engineers use, with the od mcp install command for that agent.',
        'Ask the engineering agent to read the files and port them to your framework, such as React, Next.js or Vue.',
        'Keep the DESIGN.md file in the repository so new components follow the same tokens.',
        'Review the result in a normal pull request.',
      ],
      subsections: [
        {
          heading: 'Why MCP helps',
          paragraphs: [
            'OpenDesign ships a stdio MCP server. An agent in another repository can read the live files from your OpenDesign projects, such as token CSS, components and entry HTML. It sees the current file, not an old export in a zip.',
          ],
        },
        {
          heading: 'Handoff to non-engineers',
          paragraphs: [
            'Marketing and sales often want a different format. Export a deck as PPTX or PDF. Export a motion graphic as MP4. Share the HTML when a person only needs to look at it.',
          ],
        },
      ],
    },
    {
      heading: 'Limits and honest trade-offs',
      paragraphs: [
        'This workflow is not right for every case. Be clear about its limits before you build a process around it.',
      ],
      bullets: [
        'Quality depends on the agent and the model you choose. A weak model gives weak pages.',
        'The output is code. If you want to move shapes by hand on a canvas, a canvas tool fits better.',
        'The setup needs a desktop app, a local runtime or a Docker deployment, and an agent CLI or an API key.',
        'The Design Jury is a helper. A person must still decide whether the work is good.',
      ],
    },
  ],
  faq: [
    {
      question: 'What is an AI prototyping workflow?',
      answer:
        'It is a fixed sequence in which a coding agent builds a prototype and people approve each stage. In OpenDesign the sequence is discover the brief, lock the direction, stream the artifact, critique, and deliver. Each stage produces a file or a decision you can inspect.',
    },
    {
      question: 'Which coding agents work with OpenDesign?',
      answer:
        'OpenDesign works with local agent CLIs such as Claude Code, Codex, Cursor Agent, OpenCode, Qwen and GitHub Copilot CLI. The current list lives in the runtime registry in the repository. If you have no CLI, you can use a bring-your-own-key provider configured in Settings.',
    },
    {
      question: 'What can I export from an OpenDesign prototype?',
      answer:
        'Prototypes are HTML and CSS files. Decks can export to PPTX and PDF, and HyperFrames motion graphics can export to MP4. The available export paths depend on the artifact type.',
    },
    {
      question: 'Can the AI prototype use my own brand?',
      answer:
        'Yes. You add a DESIGN.md file for your brand to the design systems folder, or let the agent create one from a screenshot or a URL. Every render then reads that file as the brand contract.',
    },
    {
      question: 'How do I hand an AI prototype to engineers?',
      answer:
        'Give them the project files, because the prototype is real HTML and CSS. You can also install the OpenDesign MCP server in their coding agent so it reads the live files. They then port the page to React, Next.js, Vue or any framework you use.',
    },
    {
      question: 'What is the Design Jury?',
      answer:
        'The Design Jury is a built-in review panel with five reviewers: Designer, Critic, Brand, Accessibility and Copy. It scores the artifact in up to three rounds by default and ships it when the composite score reaches 8.0 out of 10. A person still makes the final call.',
    },
    {
      question: 'Do I need to install anything to use the workflow?',
      answer:
        'You need the OpenDesign desktop app for macOS or Windows, or a Docker or source setup, plus a coding agent CLI or an API key. The quickstart in the repository lists the exact requirements. The project is open source under the Apache 2.0 license.',
    },
  ],
  cta: {
    heading: 'Run the loop on your next brief',
    body: 'Download OpenDesign, pick the coding agent you already use, and turn one real brief into a prototype. It is free and open source, and you can read every file it writes.',
    primaryLabel: 'Download OpenDesign',
    secondaryLabel: 'View the source on GitHub',
  },
};
