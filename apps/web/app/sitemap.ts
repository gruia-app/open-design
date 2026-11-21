import type { MetadataRoute } from 'next';
import { sitemapEntries } from '../src/seo/routes';
import { CONTENT_MODIFIED, absoluteUrl } from '../src/seo/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries().map((entry) => ({
    url: absoluteUrl(entry.path),
    lastModified: CONTENT_MODIFIED,
    changeFrequency: 'monthly',
    priority: entry.priority,
    alternates: {
      languages: { en: absoluteUrl(entry.alternates.en), es: absoluteUrl(entry.alternates.es) },
    },
  }));
}
