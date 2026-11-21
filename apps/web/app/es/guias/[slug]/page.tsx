import { guideMetadata, guideStaticParams, renderGuide } from '../../../../src/seo/routes';

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return guideStaticParams('es');
}

export async function generateMetadata({ params }: Params) {
  return guideMetadata('es', (await params).slug);
}

export default async function Page({ params }: Params) {
  return renderGuide('es', (await params).slug);
}
