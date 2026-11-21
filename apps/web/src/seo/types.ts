/**
 * Content model for the public, crawlable marketing pages (guides, guide hub,
 * showcase). These pages are statically exported next to the SPA shell and
 * exist only in English and Spanish. Their UI strings live in `site.ts`, not
 * in the app `Dict`, because the app i18n contract covers 19 locales and these
 * pages are intentionally bilingual.
 */
export type SeoLocale = 'en' | 'es';

export const SEO_LOCALES: readonly SeoLocale[] = ['en', 'es'];

export type GuideId =
  | 'open-source-collaborative-design'
  | 'design-systems-as-code'
  | 'ai-prototyping-workflow'
  | 'open-source-design-tool-comparison'
  | 'collaborative-design-review'
  | 'local-first-self-hosted-design';

export const GUIDE_IDS: readonly GuideId[] = [
  'open-source-collaborative-design',
  'design-systems-as-code',
  'ai-prototyping-workflow',
  'open-source-design-tool-comparison',
  'collaborative-design-review',
  'local-first-self-hosted-design',
];

export interface SeoTable {
  caption: string;
  columns: string[];
  /** Every row must have exactly `columns.length` cells. */
  rows: string[][];
}

export interface SeoBlock {
  /** Rendered as H3 inside a section, or H2 at section level. */
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Ordered, numbered steps. */
  steps?: string[];
  table?: SeoTable;
}

export interface SeoSection extends SeoBlock {
  subsections?: SeoBlock[];
}

export interface SeoFaq {
  question: string;
  /** Plain text. Used verbatim in FAQPage JSON-LD. */
  answer: string;
}

export interface SeoCta {
  heading: string;
  body: string;
  /** Label for the download / website link. */
  primaryLabel: string;
  /** Label for the GitHub repository link. */
  secondaryLabel: string;
}

interface SeoPageCopy {
  locale: SeoLocale;
  /** `<title>`, 30-65 characters. */
  title: string;
  /** Meta description, 110-170 characters. */
  description: string;
  ogTitle: string;
  ogDescription: string;
  keywords: string[];
  eyebrow: string;
  h1: string;
  lede: string;
  intro: string[];
  faq: SeoFaq[];
  cta: SeoCta;
}

export interface SeoGuide extends SeoPageCopy {
  id: GuideId;
  /** URL segment, lowercase ASCII with dashes. */
  slug: string;
  sections: SeoSection[];
}

export interface SeoHub extends SeoPageCopy {}

export interface SeoShowcaseItem {
  name: string;
  description: string;
  /** Repository-relative path that must exist, e.g. `design-systems/linear`. */
  path: string;
  tags: string[];
}

export interface SeoShowcaseGroup {
  id: string;
  heading: string;
  intro: string;
  items: SeoShowcaseItem[];
}

export interface SeoShowcase extends SeoPageCopy {
  groups: SeoShowcaseGroup[];
  sections: SeoSection[];
}
