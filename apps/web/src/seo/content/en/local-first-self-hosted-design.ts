import type { SeoGuide } from '../../types';

export const guide: SeoGuide = {
  id: 'local-first-self-hosted-design',
  locale: 'en',
  slug: 'local-first-self-hosted-design',
  title: 'Local-First, Self-Hosted Design Tool for Teams: OpenDesign',
  description:
    'Run design work local-first with OpenDesign: desktop app, local daemon, bring-your-own-key models, Docker self-hosting, a private plugin registry and honest limits.',
  ogTitle: 'Local-first and self-hosted design for teams',
  ogDescription:
    'How to keep design files and API keys on your own machines with OpenDesign: desktop app, Docker, private plugin registry, privacy settings and what still needs a network.',
  keywords: [
    'local-first design tool',
    'self-hosted design tool',
    'open source Figma alternative self hosted',
    'design tool bring your own key',
    'private design tool for teams',
    'self-host design software docker',
    'design tool data privacy',
    'private plugin registry',
  ],
  eyebrow: 'Guide',
  h1: 'Local-first and self-hosted design work for teams',
  lede: 'Some teams cannot send design files to a cloud service. This guide explains how OpenDesign keeps work on your machines, and where it still needs a network.',
  intro: [
    'Local-first means your files live on your computer and the app works with them there. A server is optional, not required. Self-hosted means you run the service yourself, on a machine you control.',
    'OpenDesign supports both. It is an open-source design tool under the Apache 2.0 license. It runs as a desktop app or as a Docker service. A local daemon does the work, and the coding agent or model you choose does the thinking.',
    'This guide is for teams who care about where their files and keys go. It lists what runs locally, what can leave your machine, and what the project does not do yet. We state the limits plainly, because a privacy page that only lists strengths is a brochure.',
  ],
  sections: [
    {
      heading: 'What local-first means in OpenDesign',
      paragraphs: [
        'The project describes itself as local-first. Your projects, generated files and bring-your-own-key API keys stay on your machine. Local project and file workflows keep working when the telemetry services are unreachable.',
        'One limit matters here. Model-backed features still depend on the runtime or provider you choose. If you pick a hosted model, your prompts travel to that provider. If you pick a model you host, they do not.',
      ],
      subsections: [
        {
          heading: 'The local daemon',
          paragraphs: [
            'A local daemon is the privileged part of the system. It serves the API, starts agents, manages skills and design systems, and stores artifacts. The web interface and the desktop shell talk to it.',
            'By default the daemon binds to the loopback address. Other machines on your network cannot reach it. Exposing it to a network needs explicit settings, covered later.',
          ],
        },
        {
          heading: 'Where your files live',
          paragraphs: [
            'Project files stay on your machine, or in the working directory you choose for a project. Generated artifacts are real files such as HTML and CSS, not entries in a cloud database.',
            'The repository keeps one rule for the daemon data location, and this guide does not restate it. If you must move or mount that location, read the data directory section of the repository AGENTS file first.',
          ],
        },
      ],
    },
    {
      heading: 'Desktop app: platforms and honest status',
      paragraphs: [
        'The desktop app is the simplest local-first route. It bundles the daemon and the interface, and it detects coding-agent command line tools already on your path.',
      ],
      table: {
        caption: 'Install options and their current status',
        columns: ['Option', 'Platforms', 'Status'],
        rows: [
          ['Desktop app', 'macOS on Apple Silicon and Intel', 'Published releases'],
          ['Desktop app', 'Windows x64', 'Published releases'],
          [
            'Desktop app',
            'Linux',
            'No prebuilt artifact in official releases; run from source, tracked in issue 4368',
          ],
          ['Docker Compose', 'Linux, macOS, Windows with Docker', 'Supported self-hosting path'],
          ['Run from source', 'macOS, Linux, WSL2, Windows native', 'Windows native is best-effort'],
        ],
      },
      subsections: [
        {
          heading: 'Linux users',
          paragraphs: [
            'Linux has no prebuilt desktop release today. The README says so directly, and a published Linux desktop release is still an open item on the roadmap.',
            'You have two good routes on Linux. Run OpenDesign from source, or run the Docker image. The installer script wraps Docker Compose and, on Linux, adds a systemd user unit so the service starts when you log in.',
          ],
        },
        {
          heading: 'Requirements to check',
          bullets: [
            'Node 24 and the pinned pnpm version for source builds.',
            'Docker with the Compose plugin for the container route.',
            'At least one coding-agent command line tool on your path, or a bring-your-own-key provider.',
          ],
        },
      ],
    },
    {
      heading: 'Bring your own key and model choice',
      paragraphs: [
        'OpenDesign does not ship its own agent. It uses the coding-agent command line tools you already run, such as Claude Code or Codex, and it can switch between them. Pick the one your security team already approves.',
        'If you have no such tool, a bring-your-own-key proxy offers the same loop without starting a process. You enter a base URL, a key and a model name. The proxy supports Anthropic, OpenAI, Azure, Google and Ollama routes, plus compatible presets.',
      ],
      subsections: [
        {
          heading: 'Where your keys go',
          paragraphs: [
            'The privacy page states that provider keys are stored locally. The local app and daemon use them to call the provider you selected. They are not telemetry fields and are never sent to the OpenDesign team.',
          ],
        },
        {
          heading: 'Keeping prompts inside your network',
          paragraphs: [
            'For the strictest setups, point the proxy at a model you host. The daemon blocks provider addresses in private ranges by default, to prevent server-side request forgery. The README documents how to allow an internal endpoint on purpose. Read it before you change that setting.',
            'Treat this as a trade-off. The block protects you from a bad URL. The allowance lets your own model server work. Decide once, as a team.',
          ],
        },
        {
          heading: 'Cost and billing',
          paragraphs: [
            'With a bring-your-own-key setup, you pay your provider directly. OpenDesign sets no minimum billing for that route. Check your provider terms for retention and training policies, because those apply to your prompts.',
          ],
        },
      ],
    },
    {
      heading: 'Privacy and compliance considerations',
      paragraphs: [
        'OpenDesign publishes a privacy page that matches the shipped app. Read it in full before you roll the tool out. This section summarises the points that matter for a review by your security or legal team.',
      ],
      subsections: [
        {
          heading: 'What the app can send',
          bullets: [
            'Product analytics and quality traces are on by default. You can turn them off or narrow them in Settings, under Privacy.',
            'Safety and reliability telemetry is always on in builds configured with a telemetry destination. It is limited and scrubbed, and the general analytics toggle does not disable it.',
            'Forks and development builds without telemetry credentials send neither class.',
          ],
        },
        {
          heading: 'What the app never collects',
          bullets: [
            'The contents of your generated artifact files.',
            'Your bring-your-own-key API keys, tokens and stored credentials.',
            'Readable prompt or project text in privacy-masked session replay.',
          ],
        },
        {
          heading: 'What this does not give you',
          paragraphs: [
            'OpenDesign does not claim compliance certifications. Open source and local storage help your own audit, but they do not replace one. Your team still owns questions about data residency, retention, access control and your model provider.',
            'The privacy page also warns that anonymous does not mean the network cannot see an address. Any HTTPS request exposes a source address to the receiving service. If that matters, block the telemetry hosts at your firewall.',
          ],
        },
      ],
    },
    {
      heading: 'Self-hosting with Docker',
      paragraphs: [
        'Docker is the documented beginner path for self-hosting. It suits a shared team server, a lab machine or a home server.',
      ],
      subsections: [
        {
          heading: 'Basic steps',
          steps: [
            'Install Docker Desktop, or Docker with the Compose plugin on Linux.',
            'Clone the repository and open the deploy folder.',
            'Copy the example environment file to a new environment file.',
            'Generate a random token and set it as the API token, or set up a trusted authenticated reverse proxy.',
            'Run docker compose up in the background and wait for the image to pull.',
            'Check the container with docker compose ps and request the health endpoint on the local port.',
          ],
        },
        {
          heading: 'Authentication and exposure',
          paragraphs: [
            'The compose setup maps the port to the loopback address on the host. The recommended default is a protected mode with an API token. The browser then signs in with the documented username and the token as the password.',
            'If you put a reverse proxy in front, set the allowed origins to your public address. Disable API authentication only when that proxy already authenticates every request and nothing reaches the daemon directly.',
          ],
        },
        {
          heading: 'LAN and cloud notes',
          paragraphs: [
            'To reach the daemon from other machines on a network, you must set the bind host and the allowed origins on purpose. Connector credentials and live artifact preview routes stay loopback only.',
            'The repository also holds deployment notes for Azure Container Instances and Alibaba Cloud, and a Sealos App Store template that runs the published image with persistent storage and basic authentication. Use a persistent volume for data, and follow the data directory rule in the repository.',
          ],
        },
      ],
    },
    {
      heading: 'Self-hosting a plugin registry',
      paragraphs: [
        'Plugins and skills extend OpenDesign. A registry is a source of a marketplace JSON file plus the review process behind it. In the first version it can be a static GitHub repository, GitHub Enterprise, S3 or R2 storage, or any HTTPS host.',
        'A private registry lets a team publish internal skills, such as company brand rules, without sending them to a public catalog.',
      ],
      subsections: [
        {
          heading: 'Adding and checking a registry',
          steps: [
            'Publish the marketplace JSON file at a plain HTTPS address. A GitHub tree page does not work, because the daemon rejects HTML.',
            'Add the registry with the od marketplace add command and choose a trust level, restricted or trusted.',
            'Refresh it with od marketplace refresh and search it with od marketplace search.',
            'Run od marketplace doctor with the strict flag to check identifiers, archives, license and publisher identity.',
          ],
        },
        {
          heading: 'Private GitHub Enterprise',
          paragraphs: [
            'For a private repository on GitHub Enterprise, sign in with od marketplace login. Authentication is delegated to the GitHub command line tool, and tokens stay inside it.',
          ],
        },
        {
          heading: 'Growing beyond static files',
          paragraphs: [
            'The runtime talks to a registry backend interface. A static file, a pull request registry and a database registry share the same contract. A managed database could later add private catalogs, allowlists, approval workflows and audit logs.',
            'Those database features are a design direction in the docs, not a shipped product. Plan on the static route today.',
          ],
        },
      ],
    },
    {
      heading: 'Offline-ish limits, stated plainly',
      paragraphs: [
        'Local-first does not mean offline. Be clear about this with your team before the first demo.',
      ],
      bullets: [
        'Generation needs a model. A hosted model needs internet access. A model you host needs a route to your own server.',
        'Installing the app, pulling the Docker image and installing plugins from a remote registry need a network.',
        'Optional analytics and update checks need a network. Local project and file work does not.',
        'Linux has no official desktop build yet.',
        'Comment-mode surgical edits are partly shipped, per the roadmap.',
        'Multi-user accounts and shared cloud workspaces are not something this guide claims.',
      ],
    },
    {
      heading: 'Rollout checklist for a team',
      table: {
        caption: 'Questions to settle before a team rollout',
        columns: ['Decision', 'Options', 'Who decides'],
        rows: [
          ['Install route', 'Desktop app, Docker, or from source', 'Engineering lead'],
          ['Model access', 'Approved agent command line tool, hosted key or self-hosted model', 'Security lead'],
          ['Telemetry', 'Keep defaults, narrow in Settings, or block hosts at the firewall', 'Security lead'],
          ['Exposure', 'Loopback only, reverse proxy with token, or LAN with allowed origins', 'IT'],
          ['Plugins', 'Public catalog, private static registry or none', 'Design lead'],
          ['Backups', 'Back up the persistent volume and project directories', 'IT'],
        ],
      },
    },
  ],
  faq: [
    {
      question: 'Is OpenDesign really local-first?',
      answer:
        'Yes. Projects, generated files and your own API keys stay on your machine. Model-backed features still call the runtime or provider you choose, so prompts leave the machine if that provider is hosted.',
    },
    {
      question: 'Is there an OpenDesign desktop app for Linux?',
      answer:
        'Not yet. Official releases cover macOS on Apple Silicon and Intel, and Windows x64. On Linux you can run OpenDesign from source or with Docker, and a Linux release is tracked in an open issue.',
    },
    {
      question: 'Can I self-host OpenDesign with Docker?',
      answer:
        'Yes. The repository includes a Docker Compose setup and a step-by-step guide. You set an API token or place a trusted authenticated reverse proxy in front. The daemon binds to the loopback address unless you change it on purpose.',
    },
    {
      question: 'Does OpenDesign send my designs to the cloud?',
      answer:
        'The privacy page says the contents of generated artifact files and your API keys are never collected. Analytics and quality traces are on by default and you can turn them off. A reliability channel stays on in configured builds.',
    },
    {
      question: 'Can I use my own model or API key with OpenDesign?',
      answer:
        'Yes. You can use the coding-agent command line tools on your path, or a bring-your-own-key proxy with a base URL, key and model. The proxy supports several providers, including Ollama, and keys stay on your machine.',
    },
    {
      question: 'Can I run a private plugin registry for my company?',
      answer:
        'Yes. A registry can be a static marketplace JSON file on any HTTPS host, or a GitHub Enterprise repository. You add it with od marketplace add, set a trust level and check it with od marketplace doctor.',
    },
    {
      question: 'Does OpenDesign have SOC 2 or other compliance certifications?',
      answer:
        'The project does not claim any. Local storage and open source code help your own review, but your team must assess data handling, retention and your model provider against your own rules.',
    },
  ],
  cta: {
    heading: 'Keep the files, try the tool',
    body: 'OpenDesign is open source under Apache 2.0. Download the desktop app, or clone the repository and try the Docker route on a spare machine. Your files stay where you put them.',
    primaryLabel: 'Download OpenDesign',
    secondaryLabel: 'View the repository on GitHub',
  },
};
