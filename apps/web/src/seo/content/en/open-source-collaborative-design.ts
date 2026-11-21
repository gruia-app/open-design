import type { SeoGuide } from '../../types';

export const guide: SeoGuide = {
  id: 'open-source-collaborative-design',
  locale: 'en',
  slug: 'open-source-collaborative-design',
  title: 'Open-Source Collaborative Design for Product Teams',
  description:
    'How product teams design together with open-source tools: shared design systems, shared skills, reviewable artifacts and plain governance, built on OpenDesign.',
  ogTitle: 'Open-source collaborative design, without a canvas lock-in',
  ogDescription:
    'A practical guide for product teams: share design systems, skills and artifacts through git and review them like code, using OpenDesign.',
  keywords: [
    'open source collaborative design',
    'open source design tool for teams',
    'collaborative design workflow',
    'shared design system for teams',
    'open source Figma alternative',
    'design team collaboration tools',
    'code-native design',
    'design with AI agents',
  ],
  eyebrow: 'Pillar guide',
  h1: 'Open-source collaborative design for product teams',
  lede:
    'A team can design together without one shared canvas. This guide shows a workflow built on files, git and review, using OpenDesign.',
  intro: [
    'Most design tools treat collaboration as many cursors on one canvas. That model works well for visual exploration. It works less well when the result must become real code, in a real repository, reviewed by real colleagues.',
    'OpenDesign takes a different route. It is an open-source, local-first app under the Apache 2.0 license. An AI agent that you already use produces the design as single-page artifacts: real CSS, real fonts and real components. Your brand rules live in plain files that anyone on the team can read.',
    'This guide explains how a product team can work together on top of that model. It covers roles, shared assets, setup, governance and the signs that the workflow works. We are a small project, so we keep the claims small too.',
  ],
  sections: [
    {
      heading: 'What open-source collaborative design means',
      paragraphs: [
        'Open-source collaborative design means that the tool, the design rules and the output are all open to the team. Anyone can read them, change them and propose a change. Nobody needs a special seat to do it.',
        'In OpenDesign, the pieces are files and folders. A design system is a folder with a DESIGN.md file. A skill is a folder with a SKILL.md file. The output is an artifact such as an HTML prototype, a deck or a document. Git can track all of it.',
      ],
      subsections: [
        {
          heading: 'Canvas collaboration and file collaboration',
          paragraphs: [
            'Canvas tools such as Figma are built around a shared visual surface. People edit the same frames at the same time. That is a good fit for open-ended visual work.',
            'OpenDesign is not a canvas tool. It produces code-native artifacts. The team collaborates on the inputs, which are the brief, the design system and the skills, and reviews the outputs. The two approaches can live side by side in one team.',
          ],
        },
        {
          heading: 'What stays local',
          paragraphs: [
            'OpenDesign is local-first. The desktop app runs on macOS and Windows, and the daemon reads and writes files on your machine. The agent runs through the command line tool you choose, for example Claude Code, Codex or OpenCode.',
            'This matters for teams that cannot send product work to a hosted canvas. You decide which agent and which model touch the work.',
          ],
        },
      ],
    },
    {
      heading: 'Why open source matters for team design work',
      paragraphs: [
        'A design tool becomes part of your delivery process. When the tool is closed, the team inherits its limits. When the tool is open, the team can inspect it, extend it and keep working if the plan changes.',
      ],
      bullets: [
        'Inspectable: you can read how a design system reaches the agent prompt, and you can change it.',
        'Portable: design systems, skills and templates are plain directories. They move between machines and repositories.',
        'Extensible: a team can write its own skill for a recurring task, such as a release notes page.',
        'Auditable: every change to a rule is a commit with an author and a reason.',
        'Agent-agnostic: the app detects several command line agents, so the team is not tied to one vendor.',
      ],
      subsections: [
        {
          heading: 'Open source is not free of cost',
          paragraphs: [
            'Open source moves effort to your team. Someone must own the design system folder, review changes and keep the app updated. The sections below show how to share that load.',
          ],
        },
        {
          heading: 'A neutral note on other tools',
          paragraphs: [
            'Figma, Sketch and similar tools remain strong for visual exploration and for handoff by inspection. OpenDesign targets a different step: turning a brief and a design system into running code. Many teams will use both.',
          ],
        },
      ],
    },
    {
      heading: 'Roles and workflow in a design team',
      paragraphs: [
        'A workflow needs clear roles. The roles below are suggestions, not features of the app. One person can hold several roles in a small team.',
      ],
      table: {
        caption: 'Suggested roles for a team that uses OpenDesign',
        columns: ['Role', 'Main job', 'Works on'],
        rows: [
          ['Design lead', 'Owns brand rules and quality bar', 'DESIGN.md, tokens, review of artifacts'],
          ['Product manager', 'Writes briefs and sets scope', 'Briefs, acceptance notes, priorities'],
          ['Designer', 'Directs the agent and refines output', 'Prototypes, decks, critique of results'],
          ['Front-end engineer', 'Checks that output fits the codebase', 'Generated HTML, CSS, component mapping'],
          ['Maintainer of skills', 'Packages repeated tasks', 'SKILL.md files and design templates'],
        ],
      },
      subsections: [
        {
          heading: 'A weekly loop',
          steps: [
            'The product manager writes a short brief with the goal, the audience and the constraints.',
            'The designer opens a project, picks the design system and the artifact type, and starts the session.',
            'The agent asks clarifying questions, then streams a first artifact into the preview.',
            'The designer refines the artifact in the same conversation until it matches the brief.',
            'The engineer reviews the generated markup and flags anything that does not fit the codebase.',
            'The design lead reviews the result against DESIGN.md and merges any rule changes through git.',
          ],
        },
        {
          heading: 'Where the designer stays in control',
          paragraphs: [
            'The agent does the typing. The designer still decides the direction. OpenDesign follows a loop of discovering the brief, locking the direction, building the artifact and critiquing it. Each step is visible to the person in charge.',
          ],
        },
      ],
    },
    {
      heading: 'How a team shares design systems, skills and artifacts',
      paragraphs: [
        'Sharing is the core of team work. OpenDesign gives you three things to share, and each one is a folder.',
      ],
      subsections: [
        {
          heading: 'Share design systems',
          paragraphs: [
            'A design system package holds a manifest, a DESIGN.md file and a tokens.css file. The agent reads them whenever a project uses that system. If every designer selects the same package, every artifact starts from the same rules.',
            'The repository ships a large catalog of bundled design systems, more than one hundred, that you can use as a starting point. Your own system can live next to them or in your own repository. See the guide on design systems as code for the file structure.',
          ],
        },
        {
          heading: 'Share skills and templates',
          paragraphs: [
            'A skill describes how the agent should do one kind of work. A design template describes the shape of an artifact, such as a dashboard or a pricing page. Both are plain directories.',
            'You can install a public skill with the od command line tool, for example from a GitHub repository. Your team can keep its private skills in a repository and install them on each machine.',
          ],
          bullets: [
            'Keep one repository for team skills and templates.',
            'Name each skill after the task, not after the person who wrote it.',
            'Write a short description so the agent knows when to use the skill.',
          ],
        },
        {
          heading: 'Share artifacts for review',
          paragraphs: [
            'An artifact is a file. You can export it as HTML, PDF, PPTX or video, depending on the type. You can also commit the HTML source to a repository and open a pull request.',
            'Reviewers then see a real diff. They can run the page, comment on the code and compare it with the design rules.',
          ],
        },
        {
          heading: 'Team workspaces in the command line',
          paragraphs: [
            'The od command line tool also includes a collab group. It supports team workspaces, presence, publishing a project so members can pull it, and sharing a design system, plugin or skill with the team.',
            'Treat this as the team layer on top of the file workflow. Check the current release notes and your own build before you rely on it, because it evolves faster than the file formats.',
          ],
        },
      ],
    },
    {
      heading: 'Setting up your team',
      paragraphs: [
        'You can start with one designer and one repository. Add people only after the first loop works.',
      ],
      steps: [
        'Install the desktop app or run the project from source. The quickstart lists the requirements, including Node 24 and pnpm.',
        'Install at least one supported agent command line tool and confirm that OpenDesign detects it.',
        'Create a repository for your design system, skills and templates.',
        'Pick a bundled design system that is close to your brand, or start your own with a DESIGN.md file.',
        'Run one real brief from your backlog end to end and record what went wrong.',
        'Write down the roles from the table above and name one owner for the design system.',
        'Invite a second designer and an engineer, and repeat the weekly loop for two weeks.',
      ],
      subsections: [
        {
          heading: 'A short readiness checklist',
          table: {
            caption: 'Checklist before you add more people',
            columns: ['Question', 'Healthy answer', 'If not'],
            rows: [
              ['Does the agent run on every machine?', 'Yes, detected in the app', 'Fix PATH and install the agent CLI'],
              ['Does one repository hold the design rules?', 'Yes, with one named owner', 'Create it and assign the owner'],
              ['Does a brief fit on one page?', 'Yes, with goal and constraints', 'Use a brief template and shorten it'],
              ['Can an engineer open the output?', 'Yes, as plain HTML and CSS', 'Commit the source next to the code'],
              ['Does someone review rule changes?', 'Yes, through pull requests', 'Turn on required review'],
            ],
          },
        },
        {
          heading: 'Keep the first project small',
          paragraphs: [
            'Choose a page that matters but does not block a release, such as an internal dashboard or a landing page draft. A small start gives you honest feedback with low risk.',
          ],
        },
      ],
    },
    {
      heading: 'Governance for shared design assets',
      paragraphs: [
        'Shared files need shared rules. Governance here means a few short agreements, not a committee.',
      ],
      bullets: [
        'One owner per design system. The owner approves changes to DESIGN.md and tokens.css.',
        'Changes go through pull requests. The description states which rule changes and why.',
        'Tokens and prose stay in sync. If DESIGN.md names a new accent, tokens.css changes in the same pull request.',
        'Skills have a short description and a named maintainer.',
        'Retired rules are removed, not commented out, so the agent never reads stale guidance.',
      ],
      subsections: [
        {
          heading: 'Review rules, not pixels',
          paragraphs: [
            'A good review asks whether the rule is clear and whether the artifact follows it. It does not argue about a single margin. If an artifact breaks a rule, either fix the artifact or fix the rule.',
          ],
        },
        {
          heading: 'Contribution and licensing',
          paragraphs: [
            'OpenDesign itself uses the Apache 2.0 license, and the repository accepts contributions. Your own design system and skills keep the license you give them. Decide early whether they stay private to the company or become public.',
          ],
        },
      ],
    },
    {
      heading: 'How to tell the workflow is working',
      paragraphs: [
        'We prefer qualitative signals over invented numbers. Your team knows its own baseline better than any benchmark does. Watch for the changes below over a few sprints.',
      ],
      table: {
        caption: 'Qualitative signals of a healthy workflow',
        columns: ['Signal', 'What you notice', 'Where to look'],
        rows: [
          ['Fewer rework loops', 'Designs rarely return for brand fixes', 'Pull request comments'],
          ['Faster first draft', 'A brief reaches a reviewable page the same day', 'Project history'],
          ['Consistent look', 'New pages match older pages without effort', 'Side by side screenshots'],
          ['Engineers engage early', 'Engineers comment on markup, not on missing specs', 'Review threads'],
          ['Rules improve', 'DESIGN.md changes often and in small steps', 'Git history of the design system'],
        ],
      },
      subsections: [
        {
          heading: 'Signs of trouble',
          bullets: [
            'Nobody owns the design system, and edits happen on single machines.',
            'Briefs grow longer than a page because they replace a missing rule.',
            'Engineers rewrite the output from scratch every time.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      question: 'Is there an open-source alternative to Figma for teams?',
      answer:
        'OpenDesign is an open-source option, but it works differently. It is not a shared canvas. It produces code-native artifacts from a brief and a design system, and teams collaborate through shared files and review. Many teams use it next to a canvas tool.',
    },
    {
      question: 'Can several people work on the same design at once?',
      answer:
        'The reliable path is file-based: each person works on a project, and the team merges rules and sources through git. The command line also has a collab group for team workspaces and presence. Check your build for the current state before you plan around it.',
    },
    {
      question: 'How do we keep brand consistency across designers?',
      answer:
        'Put the brand rules in a design system package with a DESIGN.md file and a tokens.css file. Every project that selects the package gives the agent the same rules. Review changes to those files through pull requests.',
    },
    {
      question: 'Do we need to run our own server?',
      answer:
        'No server is needed for the basic workflow. OpenDesign is local-first, and its daemon runs on your machine. You choose the agent command line tool and the model, so product work stays under your control.',
    },
    {
      question: 'Which AI agents does OpenDesign work with?',
      answer:
        'It detects a registry of local agent command line tools, including Claude Code, Codex, OpenCode and Cursor Agent, among others. The quickstart lists the current set. You can switch agents between sessions.',
    },
    {
      question: 'Can we share our own skills with the team?',
      answer:
        'Yes. A skill is a folder with a SKILL.md file. Keep team skills in a repository and install them with the od command line tool from a GitHub source. The team can then use the same skills on every machine.',
    },
    {
      question: 'How should a team review AI-generated design?',
      answer:
        'Review it like code. Commit the HTML source, open a pull request and check it against DESIGN.md. Engineers can run the page, and the design lead can confirm that the rules were followed.',
    },
    {
      question: 'What does it cost to adopt?',
      answer:
        'The app is open source under the Apache 2.0 license. Your costs are the agent or model you connect and the time your team spends to own the design system. We do not publish prices for third-party models here.',
    },
  ],
  cta: {
    heading: 'Try one brief with your team',
    body:
      'Download the app, pick a design system and run one real brief. If it helps, share the repository with a colleague. If not, tell us what broke.',
    primaryLabel: 'Download OpenDesign',
    secondaryLabel: 'View the repository on GitHub',
  },
};
