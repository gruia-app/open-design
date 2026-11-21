import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuidePage, HubPage, ShowcasePage } from './components';
import { pageMetadata, type LocalizedPaths } from './metadata';
import { guideById, guideBySlug, guidesFor, hubFor, showcaseFor } from './registry';
import { SEO_PATHS } from './site';
import type { SeoGuide, SeoLocale } from './types';

/** Thin per-locale route bindings shared by `app/guides/**` and `app/es/guias/**`. */

function guidePaths(guide: SeoGuide): LocalizedPaths {
  return {
    en: SEO_PATHS.guide('en', guideById('en', guide.id).slug),
    es: SEO_PATHS.guide('es', guideById('es', guide.id).slug),
  };
}

export function guideStaticParams(locale: SeoLocale) {
  return guidesFor(locale).map((guide) => ({ slug: guide.slug }));
}

export function guideMetadata(locale: SeoLocale, slug: string): Metadata {
  const guide = guideBySlug(locale, slug);
  if (!guide) return {};
  return pageMetadata({ ...guide, paths: guidePaths(guide), type: 'article' });
}

export function renderGuide(locale: SeoLocale, slug: string) {
  const guide = guideBySlug(locale, slug);
  if (!guide) notFound();
  const related = guidesFor(locale).filter((item) => item.id !== guide.id);
  return <GuidePage guide={guide} paths={guidePaths(guide)} related={related} />;
}

export function hubMetadata(locale: SeoLocale): Metadata {
  return pageMetadata({ ...hubFor(locale), paths: SEO_PATHS.hub, type: 'website' });
}

export function renderHub(locale: SeoLocale) {
  return <HubPage hub={hubFor(locale)} guides={guidesFor(locale)} paths={SEO_PATHS.hub} />;
}

export function showcaseMetadata(locale: SeoLocale): Metadata {
  return pageMetadata({ ...showcaseFor(locale), paths: SEO_PATHS.showcase, type: 'website' });
}

export function renderShowcase(locale: SeoLocale) {
  return <ShowcasePage showcase={showcaseFor(locale)} paths={SEO_PATHS.showcase} />;
}

export function sitemapEntries() {
  const entries: { path: string; alternates: LocalizedPaths; priority: number }[] = [];
  for (const locale of ['en', 'es'] as const) {
    entries.push({ path: SEO_PATHS.hub[locale], alternates: SEO_PATHS.hub, priority: 0.8 });
    entries.push({ path: SEO_PATHS.showcase[locale], alternates: SEO_PATHS.showcase, priority: 0.7 });
    for (const guide of guidesFor(locale)) {
      const paths = guidePaths(guide);
      entries.push({ path: paths[locale], alternates: paths, priority: 0.7 });
    }
  }
  return entries;
}
