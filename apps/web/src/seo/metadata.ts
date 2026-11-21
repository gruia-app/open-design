import type { Metadata } from 'next';
import type { SeoFaq, SeoGuide, SeoLocale } from './types';
import {
  CONTENT_MODIFIED,
  CONTENT_PUBLISHED,
  OG_IMAGE_URL,
  OG_LOCALE,
  SEO_PATHS,
  SITE_NAME,
  SITE_URL,
  X_HANDLE,
  absoluteUrl,
} from './site';

export type LocalizedPaths = Record<SeoLocale, string>;

interface PageMetadataInput {
  locale: SeoLocale;
  paths: LocalizedPaths;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  keywords: string[];
  type: 'article' | 'website';
}

/**
 * Canonical + hreflang invariant: every page points its canonical at itself
 * and lists both language versions plus `x-default` (English).
 */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const { locale, paths } = input;
  const other: SeoLocale = locale === 'en' ? 'es' : 'en';
  return {
    metadataBase: new URL(SITE_URL),
    title: { absolute: input.title },
    description: input.description,
    keywords: input.keywords,
    alternates: {
      canonical: absoluteUrl(paths[locale]),
      languages: {
        en: absoluteUrl(paths.en),
        es: absoluteUrl(paths.es),
        'x-default': absoluteUrl(paths.en),
      },
    },
    openGraph: {
      type: input.type,
      url: absoluteUrl(paths[locale]),
      siteName: SITE_NAME,
      title: input.ogTitle,
      description: input.ogDescription,
      locale: OG_LOCALE[locale],
      alternateLocale: [OG_LOCALE[other]],
      images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: input.ogTitle }],
      ...(input.type === 'article'
        ? { publishedTime: CONTENT_PUBLISHED, modifiedTime: CONTENT_MODIFIED }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      site: X_HANDLE,
      title: input.ogTitle,
      description: input.ogDescription,
      images: [OG_IMAGE_URL],
    },
    robots: { index: true, follow: true },
  };
}

const ORGANIZATION = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: absoluteUrl('/app-icon.png'),
};

export function faqJsonLd(faq: SeoFaq[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function articleJsonLd(guide: SeoGuide) {
  const url = absoluteUrl(SEO_PATHS.guide(guide.locale, guide.slug));
  return {
    '@type': 'TechArticle',
    headline: guide.h1,
    description: guide.description,
    inLanguage: guide.locale,
    url,
    mainEntityOfPage: url,
    image: OG_IMAGE_URL,
    datePublished: CONTENT_PUBLISHED,
    dateModified: CONTENT_MODIFIED,
    keywords: guide.keywords.join(', '),
    author: ORGANIZATION,
    publisher: ORGANIZATION,
  };
}

export function collectionJsonLd(input: {
  locale: SeoLocale;
  path: string;
  name: string;
  description: string;
  items: { name: string; url: string }[];
}) {
  return {
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    inLanguage: input.locale,
    url: absoluteUrl(input.path),
    publisher: ORGANIZATION,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: input.items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: item.url,
      })),
    },
  };
}

/** Serialises a JSON-LD graph so it is safe inside a `<script>` element. */
export function serializeJsonLd(nodes: object[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
}
