import type { GuideId, SeoGuide, SeoHub, SeoLocale, SeoShowcase } from './types';
import { GUIDE_IDS } from './types';
import { guide as enCollab } from './content/en/open-source-collaborative-design';
import { guide as enSystems } from './content/en/design-systems-as-code';
import { guide as enPrototyping } from './content/en/ai-prototyping-workflow';
import { guide as enComparison } from './content/en/open-source-design-tool-comparison';
import { guide as enReview } from './content/en/collaborative-design-review';
import { guide as enLocalFirst } from './content/en/local-first-self-hosted-design';
import { guide as esCollab } from './content/es/open-source-collaborative-design';
import { guide as esSystems } from './content/es/design-systems-as-code';
import { guide as esPrototyping } from './content/es/ai-prototyping-workflow';
import { guide as esComparison } from './content/es/open-source-design-tool-comparison';
import { guide as esReview } from './content/es/collaborative-design-review';
import { guide as esLocalFirst } from './content/es/local-first-self-hosted-design';
import { hub as enHub } from './content/en/hub';
import { hub as esHub } from './content/es/hub';
import { showcase as enShowcase } from './content/en/showcase';
import { showcase as esShowcase } from './content/es/showcase';

const GUIDES: Record<SeoLocale, Record<GuideId, SeoGuide>> = {
  en: {
    'open-source-collaborative-design': enCollab,
    'design-systems-as-code': enSystems,
    'ai-prototyping-workflow': enPrototyping,
    'open-source-design-tool-comparison': enComparison,
    'collaborative-design-review': enReview,
    'local-first-self-hosted-design': enLocalFirst,
  },
  es: {
    'open-source-collaborative-design': esCollab,
    'design-systems-as-code': esSystems,
    'ai-prototyping-workflow': esPrototyping,
    'open-source-design-tool-comparison': esComparison,
    'collaborative-design-review': esReview,
    'local-first-self-hosted-design': esLocalFirst,
  },
};

const HUBS: Record<SeoLocale, SeoHub> = { en: enHub, es: esHub };
const SHOWCASES: Record<SeoLocale, SeoShowcase> = { en: enShowcase, es: esShowcase };

export function guidesFor(locale: SeoLocale): SeoGuide[] {
  return GUIDE_IDS.map((id) => GUIDES[locale][id]);
}

export function guideById(locale: SeoLocale, id: GuideId): SeoGuide {
  return GUIDES[locale][id];
}

export function guideBySlug(locale: SeoLocale, slug: string): SeoGuide | undefined {
  return guidesFor(locale).find((guide) => guide.slug === slug);
}

export function hubFor(locale: SeoLocale): SeoHub {
  return HUBS[locale];
}

export function showcaseFor(locale: SeoLocale): SeoShowcase {
  return SHOWCASES[locale];
}

/** Word count over every rendered text field; drives the reading time. */
export function wordCount(value: unknown): number {
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean).length;
  if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + wordCount(item), 0);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).reduce((sum: number, item) => sum + wordCount(item), 0);
  }
  return 0;
}

export function readingMinutes(guide: SeoGuide): number {
  return Math.max(1, Math.round(wordCount([guide.intro, guide.sections, guide.faq]) / 220));
}
