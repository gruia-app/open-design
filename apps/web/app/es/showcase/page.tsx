import { renderShowcase, showcaseMetadata } from '../../../src/seo/routes';

export const dynamic = 'force-static';
export const metadata = showcaseMetadata('es');

export default function Page() {
  return renderShowcase('es');
}
