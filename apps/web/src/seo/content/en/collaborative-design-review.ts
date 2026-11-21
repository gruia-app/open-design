import type { SeoGuide } from '../../types';

export const guide: SeoGuide = {
  id: 'collaborative-design-review',
  locale: 'en',
  slug: 'collaborative-design-review',
  title: 'Collaborative Design Review and Critique with OpenDesign',
  description:
    'Run design review and critique loops with OpenDesign: a built-in five-role Design Jury, preview annotations, review rubrics, async git review and a checklist.',
  ogTitle: 'How to run a collaborative design review with OpenDesign',
  ogDescription:
    'A practical guide to design critique: roles, rubrics, annotations, async review through git and a checklist that turns feedback into the next iteration.',
  keywords: [
    'collaborative design review',
    'design critique process',
    'design review checklist',
    'async design review',
    'open source design collaboration tool',
    'design feedback workflow',
    'design critique rubric',
    'review AI generated design',
  ],
  eyebrow: 'Guide',
  h1: 'Collaborative design review and critique with OpenDesign',
  lede: 'A design review is a short meeting with a long tail of follow-up. This guide shows how to keep both small, and where OpenDesign helps.',
  intro: [
    'Most design reviews fail in the same way. People arrive with different goals, give feedback in different formats, and leave without a clear list of changes. The next version then ignores half of what was said.',
    'OpenDesign is an open-source design tool that works with the coding agents you already run. It generates real HTML, CSS and documents from a brief. That changes review a little. The artifact is a file, so you can open it, annotate it, diff it and send it back to the agent.',
    'This guide covers the parts of review that OpenDesign supports today, and the parts it does not. It is honest about the gaps. Where the product has no feature, the guide shows how to cover the need with a rubric, a repository and a few agreed habits.',
  ],
  sections: [
    {
      heading: 'What a good design review looks like',
      paragraphs: [
        'A good review answers one question: does this work meet the brief? It does not ask whether the reviewer would have designed it differently. That difference sounds small. It decides whether the meeting ends in a list of changes or in an argument.',
        'Keep the review short and specific. Share the brief first. Share the artifact second. Collect feedback against named criteria, not against taste.',
      ],
      subsections: [
        {
          heading: 'Review the brief before the pixels',
          paragraphs: [
            'Start every review by reading the brief aloud. The brief states the audience, the goal and the constraints. Every comment should trace back to one of those three.',
            'If a comment does not trace back, park it. Write it down as a separate idea for later. This keeps the review on the work and keeps the author calm.',
          ],
        },
        {
          heading: 'Separate critique from approval',
          paragraphs: [
            'Critique helps the author improve the work. Approval decides whether the work ships. Mix them and people hold back honest notes, because every note feels like a veto.',
            'Hold critique first, with no decision attached. Then ask one person, named in advance, to approve or request changes.',
          ],
        },
      ],
    },
    {
      heading: 'Roles in a review',
      paragraphs: [
        'A review works best when each person knows their job. Small teams can give one person several roles. Name the roles anyway.',
      ],
      bullets: [
        'Author: presents the work, explains the choices, and records the feedback without defending.',
        'Facilitator: keeps time, reads the brief, and stops side discussions.',
        'Reviewers: give feedback against the agreed criteria, one point at a time.',
        'Decision owner: approves the work or requests changes at the end.',
        'Engineer on call: flags what is expensive to build, early, before the design hardens.',
      ],
      subsections: [
        {
          heading: 'Let the agent be a reviewer, not the decider',
          paragraphs: [
            'OpenDesign includes a panel called Design Jury. It reviews each generation before it ships. It is a useful first reader. It is not the decision owner.',
            'Treat its score as one opinion. Your team still decides what counts as done.',
          ],
        },
        {
          heading: 'Invite fewer people than you think',
          paragraphs: [
            'Three to five reviewers cover most work. More voices add more conflicting notes and few new insights. Invite specialists only when the artifact needs them, for example an accessibility lead for a form flow.',
          ],
        },
      ],
    },
    {
      heading: 'The built-in critique loop: Design Jury',
      paragraphs: [
        'When an agent produces an artifact, OpenDesign can wrap it in a structured review cycle. The product calls it Design Jury. In the code and documentation it is called Critique Theater.',
        'Five panelists score the artifact: Designer, Critic, Brand, Accessibility and Copy. They run as turns inside the same agent session. OpenDesign does not start extra processes for them.',
      ],
      subsections: [
        {
          heading: 'How the rounds work',
          paragraphs: [
            'The run has up to three rounds by default. After each round, OpenDesign computes a composite score from the panelist scores. If the composite reaches 8.0 out of 10, the artifact ships. If not, the agent revises and a new round starts.',
            'If three rounds do not reach the threshold, the default policy ships the best round. The result badge then says the run finished below the threshold. You see that fact. Nothing hides it.',
          ],
          bullets: [
            'Critic carries a weight of 0.4 in the composite.',
            'Brand, Accessibility and Copy carry 0.2 each.',
            'Designer carries zero weight in version one. Its notes still appear in the transcript.',
            'The threshold and the weights are read-only in the current version.',
          ],
        },
        {
          heading: 'Reading the result',
          paragraphs: [
            'After a run settles, the panel collapses to a badge. The badge shows the final composite and the round that closed the run. It also shows a status: shipped, below threshold, timed out, interrupted or degraded.',
            'Degraded means the panel was offline for that run, for example because the agent adapter could not produce a valid critique. Do not read a degraded run as a pass.',
          ],
        },
        {
          heading: 'Replay a past review',
          paragraphs: [
            'Every run writes a structured transcript. The Replay button plays it back in a read-only view. You can scrub round by round with the J and K keys and leave with Escape.',
            'Replay is useful in a team review. The facilitator can show what the panel said without rerunning the generation.',
          ],
        },
        {
          heading: 'Turn it on for the right projects',
          paragraphs: [
            'The panel is a setting, not a given. A skill can require it, allow it or opt out of it. You can also enable it per project in Settings, in the Design Jury section. Skills that produce a fixed export usually opt out.',
            'Check the setting before you rely on it. If the panel is off, no score appears, and that is easy to miss.',
          ],
        },
      ],
    },
    {
      heading: 'Comments and annotations on the preview',
      paragraphs: [
        'Human feedback beats panel feedback for taste, context and politics. OpenDesign gives you a way to point at the thing you mean.',
        'The chat composer accepts visual annotations drawn on the preview. They travel with your message as attachments, so the agent sees which part of the page you marked.',
      ],
      subsections: [
        {
          heading: 'What works today, and what is partial',
          paragraphs: [
            'The project roadmap lists comment-mode surgical edits as partially shipped. Targeted patching of a single element is still in progress. Expect the agent to regenerate more than the one element you marked in some cases.',
            'Plan for that. After each targeted change, review the whole page again. Do not assume the rest stayed the same.',
          ],
        },
        {
          heading: 'Write annotations an agent can act on',
          bullets: [
            'Say what is wrong and what you want instead, in one sentence.',
            'Name the criterion, for example contrast, spacing or tone.',
            'Mark one issue per annotation.',
            'Avoid words like nicer or cleaner. Give a measurable change.',
          ],
        },
      ],
    },
    {
      heading: 'A rubric your whole team can reuse',
      paragraphs: [
        'A rubric turns opinion into a checklist. The Design Jury uses five lenses. You can borrow the same five for human review and add your own.',
        'Score each criterion from one to five, or use pass and fail. Keep the scale the same for every review, so results compare over time.',
      ],
      table: {
        caption: 'Review rubric based on the five Design Jury lenses',
        columns: ['Lens', 'Question to ask', 'Evidence to check'],
        rows: [
          [
            'Design',
            'Do layout, hierarchy and spacing guide the eye?',
            'Squint test, grid alignment, visual weight of the main action',
          ],
          [
            'Brief fit',
            'Does the work meet the audience and goal in the brief?',
            'Brief checklist, primary task completed in under a minute',
          ],
          [
            'Brand',
            'Do color, type and voice match the design system?',
            'Token usage against the DESIGN.md file, no off-palette colors',
          ],
          [
            'Accessibility',
            'Can people with different abilities use it?',
            'Contrast ratios, focus rings, heading order, alt text',
          ],
          [
            'Copy',
            'Is the text short, clear and in the right tone?',
            'Read aloud, error messages say what to do next',
          ],
        ],
      },
    },
    {
      heading: 'Async review through git and pull requests',
      paragraphs: [
        'Not every review needs a meeting. Async review works well for distributed teams and for small changes. OpenDesign does not host reviews itself, so this part relies on tools you already have.',
        'The reason it works is simple. OpenDesign produces ordinary files, and ordinary files fit into git. This guide does not claim a built-in pull request feature. It describes a habit.',
      ],
      subsections: [
        {
          heading: 'A simple async flow',
          steps: [
            'Generate or revise the artifact in OpenDesign and export or copy the files into a repository you control.',
            'Open a branch and a pull request. Put the brief and the rubric in the description.',
            'Attach screenshots or a short screen recording of the artifact so reviewers need not run anything.',
            'Ask each reviewer to comment against the rubric lenses, one comment per issue.',
            'Let the decision owner approve or request changes within a stated time window, for example two working days.',
            'Merge when the checklist is complete, and link the merged version to the original brief.',
          ],
        },
        {
          heading: 'Why a diff helps design review',
          paragraphs: [
            'A diff shows what changed between two iterations. Reviewers stop re-reading the full page. They check only what moved.',
            'This matters most when an agent regenerates more than you asked. A diff catches the surprise before it ships.',
          ],
        },
        {
          heading: 'Keep the brief next to the work',
          paragraphs: [
            'Store the brief in the same repository, in plain text. Reviewers then read the brief and the artifact in one place. Future you will also thank present you.',
          ],
        },
      ],
    },
    {
      heading: 'Turning feedback into the next iteration',
      paragraphs: [
        'Feedback has no value until it changes the work. The step between the two is where most teams lose time.',
      ],
      subsections: [
        {
          heading: 'Triage the notes',
          paragraphs: [
            'Sort every note into three groups: must fix, should fix and later. Must-fix items block approval. Should-fix items go in if they are cheap. Later items go to a backlog with the author named.',
            'Design Jury uses the same idea. The panel tracks a cumulative must-fix count across rounds, so a clear must-fix list is a familiar shape for the agent as well.',
          ],
        },
        {
          heading: 'Write one revision brief',
          steps: [
            'List the must-fix items in order of impact.',
            'Write each as an instruction: what to change, where, and how to check it.',
            'Add the constraints that must not change, for example the navigation and the brand colors.',
            'Send the list to the agent in one message, with the marked annotations attached.',
            'Review the new version against the same rubric, not a new one.',
          ],
        },
        {
          heading: 'Close the loop',
          paragraphs: [
            'Tell reviewers what you changed and what you parked. A short reply is enough. People give better feedback next time when they see that the last round counted.',
          ],
        },
      ],
    },
    {
      heading: 'Design review checklist',
      paragraphs: [
        'Use this table before, during and after each review. Copy it into your pull request template or your wiki.',
      ],
      table: {
        caption: 'Checklist for a collaborative design review',
        columns: ['Stage', 'Check', 'Owner'],
        rows: [
          ['Before', 'The brief states audience, goal and constraints', 'Author'],
          ['Before', 'The artifact opens without setup and has screenshots attached', 'Author'],
          ['Before', 'Design Jury was enabled for the project and its result was read', 'Author'],
          ['During', 'The facilitator reads the brief first', 'Facilitator'],
          ['During', 'Every comment names a rubric lens', 'Reviewers'],
          ['During', 'Critique and approval are separate steps', 'Facilitator'],
          ['After', 'Notes are sorted into must fix, should fix and later', 'Author'],
          ['After', 'One revision brief goes to the agent', 'Author'],
          ['After', 'The decision owner records approve or changes requested', 'Decision owner'],
        ],
      },
    },
    {
      heading: 'Common mistakes',
      bullets: [
        'Reviewing without the brief, so feedback drifts toward personal taste.',
        'Treating the panel score as approval. It is one input.',
        'Sending feedback as ten separate chat messages instead of one revision brief.',
        'Forgetting that targeted edits may touch more than the marked element.',
        'Skipping the re-review because the change looked small.',
      ],
    },
  ],
  faq: [
    {
      question: 'What is a collaborative design review?',
      answer:
        'It is a structured session where several people judge a design against a shared brief. The goal is a clear list of changes and a named decision. Good reviews use agreed criteria, defined roles and written outcomes.',
    },
    {
      question: 'Does OpenDesign have a built-in design critique feature?',
      answer:
        'Yes. A panel called Design Jury reviews each generation before it ships. Five panelists score the artifact over up to three rounds. You can turn it on per project in Settings, and a skill can require it or opt out.',
    },
    {
      question: 'Can reviewers comment directly on the design?',
      answer:
        'You can draw visual annotations on the preview and send them with your message to the agent. The project lists comment-mode surgical edits as partially shipped. Multi-person comment threads are not part of what this guide claims.',
    },
    {
      question: 'How do I run an async design review with OpenDesign?',
      answer:
        'Put the generated files in a git repository and open a pull request. Add the brief, the rubric and screenshots to the description. Reviewers comment against the rubric, and a named decision owner approves within an agreed window.',
    },
    {
      question: 'What score does the Design Jury need to approve a design?',
      answer:
        'The composite must reach 8.0 out of 10. If it does not after three rounds, the default policy ships the best round and the badge shows that it finished below the threshold. The threshold is read-only in the current version.',
    },
    {
      question: 'Who should be in a design review?',
      answer:
        'Use an author, a facilitator, three to five reviewers and one decision owner. Add an engineer early to flag build cost. Invite a specialist, such as an accessibility lead, only when the work needs one.',
    },
    {
      question: 'How do I turn feedback into the next iteration?',
      answer:
        'Sort notes into must fix, should fix and later. Write the must-fix items as one revision brief with instructions and constraints. Send it to the agent with annotations attached, then review the result against the same rubric.',
    },
  ],
  cta: {
    heading: 'Try a review loop on your next draft',
    body: 'OpenDesign is open source. Install the desktop app, generate a first draft, and turn on Design Jury for the project. It takes a few minutes, give or take a coffee.',
    primaryLabel: 'Download OpenDesign',
    secondaryLabel: 'View the repository on GitHub',
  },
};
