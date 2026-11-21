import { renderShowcase, showcaseMetadata } from '../../src/seo/routes';

export const dynamic = 'force-static';
export const metadata = showcaseMetadata('en');

export default function Page() {
  return renderShowcase('en');
}
