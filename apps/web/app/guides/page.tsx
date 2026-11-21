import { hubMetadata, renderHub } from '../../src/seo/routes';

export const dynamic = 'force-static';
export const metadata = hubMetadata('en');

export default function Page() {
  return renderHub('en');
}
