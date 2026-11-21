import type { SeoHub } from '../../types';

export const hub: SeoHub = {
  locale: 'en',
  title: 'Open-Source Design Guides for Teams | OpenDesign',
  description:
    'Plain guides on open-source collaborative design, DESIGN.md design systems, AI prototyping, design review and self-hosting. Written for designers and product teams.',
  ogTitle: 'Open-Source Design Guides for Teams',
  ogDescription:
    'Six plain guides on open-source collaborative design, design systems as code, AI prototyping, design review and local-first tools.',
  keywords: [
    'open source design tool guides',
    'collaborative design guides',
    'design system as code',
    'DESIGN.md guide',
    'AI prototyping workflow',
    'open source Figma alternative',
    'self-hosted design tools',
    'design review process',
  ],
  eyebrow: 'Guides',
  h1: 'Guides for open-source collaborative design',
  lede:
    'Six short guides for designers and product teams who want tools they can read, change and run themselves.',
  intro: [
    'These guides come from the same place as the code. We build OpenDesign in the open, and we kept answering the same questions. How do we design together without a closed tool? Where do design rules live? How do we get from a brief to a working prototype? So we wrote the answers down. We kept them plain, because a guide that needs a glossary has already failed. Every guide follows the same shape: a short answer first, then the steps, then the questions people ask.',
    'The collection has six guides. The first explains what open-source collaborative design means and what it changes for a team. The second shows how to keep a design system as code in a DESIGN.md file. The third walks through an AI prototyping workflow, from brief to prototype. Each guide stands on its own, so start with the one that matches your problem. You can read them in any order, and none of them depends on the others.',
    'The last three guides cover the decisions around the tools. One compares open-source design tools on the points that matter to a team. One describes a collaborative design review that does not turn into a meeting about opinions. One explains local-first and self-hosted design: what stays on your machine, what leaves it, and who controls the data. We write for designers and product teams, not for tool vendors. Steps are short and concrete.',
    'Where a guide mentions a feature of OpenDesign, it points to the files in the public repository so you can check the claim. Where another tool does something better, we say so. The repository is Apache-2.0 licensed, so you can also copy anything you find useful. You do not need to install anything to read the guides. The showcase page lists real design systems, templates, skills and plugins if you want to try the ideas. Guides are not a course, so skim the headings and take the steps you need.',
  ],
  faq: [
    {
      question: 'What are these guides about?',
      answer:
        'They explain how designers and product teams can work together with open-source tools. The topics are collaborative design, design systems as code, AI prototyping, tool comparison, design review and self-hosted design. Each guide is short and practical.',
    },
    {
      question: 'Who should read them?',
      answer:
        'The guides are for designers, product managers and engineers who share design work. You do not need to code to follow them. A few steps mention a terminal or a Markdown file, and we explain each one.',
    },
    {
      question: 'Do I need OpenDesign to follow the guides?',
      answer:
        'No. The ideas apply to any open-source or self-hosted design setup. The guides use OpenDesign for examples because we know it best, and they link to the public files so you can check every claim.',
    },
    {
      question: 'Is OpenDesign free and open source?',
      answer:
        'The OpenDesign repository is public and uses the Apache-2.0 license. You can read the source, run it on your own machine and change it. The repository README lists the current options for models and agents.',
    },
    {
      question: 'What is a DESIGN.md file?',
      answer:
        'A DESIGN.md file describes the visual language of a product in plain Markdown: color, type, spacing, components and rules. People read it, and so do AI agents. Because it is a text file, you can version it, review it and share it like code.',
    },
    {
      question: 'Where can I see real examples?',
      answer:
        'The showcase page lists design systems, design templates, skills, plugins and craft rules from the repository. Each entry links to its folder on GitHub. You can open the files and read exactly what they contain.',
    },
    {
      question: 'How often do you update the guides?',
      answer:
        'We update a guide when the project changes in a way that affects it. The repository history shows what changed and when. If you find a mistake, open an issue on GitHub and we will fix it.',
    },
    {
      question: 'Can I contribute to OpenDesign or to the guides?',
      answer:
        'Yes. The contributing guide in the repository explains how to add a design system, a design template, a skill or a translation. A small pull request is welcome, and so is a bug report.',
    },
  ],
  cta: {
    heading: 'Try it on a real brief',
    body: 'Read a guide, then open OpenDesign and run the steps on your own project. The source is public. If something is unclear, tell us and we will fix the guide.',
    primaryLabel: 'Download OpenDesign',
    secondaryLabel: 'View the repository on GitHub',
  },
};
