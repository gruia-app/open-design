import type { SeoLocale } from './types';

/**
 * Public origin used for canonical, hreflang, Open Graph and sitemap URLs.
 * Deployments of a fork set `NEXT_PUBLIC_OD_SITE_URL` at build time; the
 * default is the official OpenDesign website.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_OD_SITE_URL || 'https://open-design.ai').replace(/\/+$/, '');

export const SITE_NAME = 'OpenDesign';
export const REPO_URL = 'https://github.com/nexu-io/open-design';
export const DOWNLOAD_URL = 'https://open-design.ai/';
export const DISCORD_URL = 'https://discord.gg/mHAjSMV6gz';
export const X_HANDLE = '@OpenDesignHQ';
export const OG_IMAGE_URL = 'https://repo-assets.open-design.ai/resources/images/hero.png';
export const CONTENT_PUBLISHED = '2026-11-21';
export const CONTENT_MODIFIED = '2026-11-21';

export const OG_LOCALE: Record<SeoLocale, string> = { en: 'en_US', es: 'es_ES' };

export const SEO_PATHS = {
  hub: { en: '/guides', es: '/es/guias' },
  guide: (locale: SeoLocale, slug: string) => `${SEO_PATHS.hub[locale]}/${slug}`,
  showcase: { en: '/showcase', es: '/es/showcase' },
} as const;

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function repoTreeUrl(path: string): string {
  return `${REPO_URL}/tree/main/${path}`;
}

export interface SeoUiCopy {
  home: string;
  guides: string;
  showcase: string;
  onThisPage: string;
  faq: string;
  related: string;
  minRead: string;
  updated: string;
  switchLanguage: string;
  switchLanguageLabel: string;
  viewOnGithub: string;
  allGuides: string;
  discord: string;
  footer: string;
}

export const SEO_UI: Record<SeoLocale, SeoUiCopy> = {
  en: {
    home: 'OpenDesign',
    guides: 'Guides',
    showcase: 'Showcase',
    onThisPage: 'On this page',
    faq: 'Frequently asked questions',
    related: 'More guides',
    minRead: 'min read',
    updated: 'Updated',
    switchLanguage: 'Leer en español',
    switchLanguageLabel: 'Spanish version of this page',
    viewOnGithub: 'View on GitHub',
    allGuides: 'All guides',
    discord: 'Join the Discord',
    footer: 'OpenDesign is open source under the Apache 2.0 license.',
  },
  es: {
    home: 'OpenDesign',
    guides: 'Guías',
    showcase: 'Showcase',
    onThisPage: 'En esta página',
    faq: 'Preguntas frecuentes',
    related: 'Más guías',
    minRead: 'min de lectura',
    updated: 'Actualizado',
    switchLanguage: 'Read in English',
    switchLanguageLabel: 'Versión en inglés de esta página',
    viewOnGithub: 'Ver en GitHub',
    allGuides: 'Todas las guías',
    discord: 'Entra en el Discord',
    footer: 'OpenDesign es software libre con licencia Apache 2.0.',
  },
};
