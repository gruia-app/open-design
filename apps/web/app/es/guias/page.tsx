import { hubMetadata, renderHub } from '../../../src/seo/routes';

export const dynamic = 'force-static';
export const metadata = hubMetadata('es');

export default function Page() {
  return renderHub('es');
}
