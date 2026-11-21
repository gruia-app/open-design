import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../src/seo/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/guides', '/es/guias', '/showcase', '/es/showcase'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
