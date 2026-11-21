import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pageMetadata } from '../../src/seo/metadata';
import { guideById, guidesFor, hubFor, showcaseFor, wordCount } from '../../src/seo/registry';
import { sitemapEntries } from '../../src/seo/routes';
import { SEO_PATHS, absoluteUrl } from '../../src/seo/site';
import { GUIDE_IDS, SEO_LOCALES, type SeoFaq, type SeoSection } from '../../src/seo/types';

const REPO_ROOT = resolve(__dirname, '../../../..');
// Case-sensitive on purpose: Spanish copy legitimately uses the word "todo".
const PLACEHOLDER = /\b(?:TODO|TBD|FIXME)\b|\b(?:[Ll]orem|[Ii]psum)\b|\[\.\.\.\]|\*\*/;

function expectCopyLimits(page: { title: string; description: string; ogTitle: string; ogDescription: string; keywords: string[] }) {
  expect(page.title.length).toBeGreaterThanOrEqual(30);
  expect(page.title.length).toBeLessThanOrEqual(65);
  expect(page.description.length).toBeGreaterThanOrEqual(110);
  expect(page.description.length).toBeLessThanOrEqual(170);
  expect(page.ogTitle.length).toBeLessThanOrEqual(90);
  expect(page.ogDescription.length).toBeLessThanOrEqual(200);
  expect(page.keywords.length).toBeGreaterThanOrEqual(5);
}

function expectFaq(faq: SeoFaq[]) {
  expect(faq.length).toBeGreaterThanOrEqual(6);
  expect(new Set(faq.map((item) => item.question)).size).toBe(faq.length);
  for (const item of faq) expect(item.answer.length).toBeGreaterThan(80);
}

function expectTables(sections: SeoSection[]) {
  for (const block of sections.flatMap((section) => [section, ...(section.subsections ?? [])])) {
    if (!block.table) continue;
    for (const row of block.table.rows) expect(row).toHaveLength(block.table.columns.length);
  }
}

describe('SEO guides', () => {
  for (const locale of SEO_LOCALES) {
    describe(locale, () => {
      const guides = guidesFor(locale);

      it('has every guide with a unique, URL-safe slug', () => {
        expect(guides.map((guide) => guide.id)).toEqual([...GUIDE_IDS]);
        expect(new Set(guides.map((guide) => guide.slug)).size).toBe(GUIDE_IDS.length);
        for (const guide of guides) {
          expect(guide.locale).toBe(locale);
          expect(guide.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        }
      });

      for (const guide of guides) {
        it(`${guide.id} is long-form, structured and publishable`, () => {
          expectCopyLimits(guide);
          expectFaq(guide.faq);
          expectTables(guide.sections);
          expect(guide.sections.length).toBeGreaterThanOrEqual(7);
          expect(guide.sections.filter((section) => section.subsections?.length).length).toBeGreaterThanOrEqual(3);
          expect(new Set(guide.sections.map((section) => section.heading)).size).toBe(guide.sections.length);
          expect(wordCount([guide.intro, guide.sections, guide.faq])).toBeGreaterThanOrEqual(1500);
          expect(JSON.stringify(guide)).not.toMatch(PLACEHOLDER);
        });
      }
    });
  }

  it('keeps hreflang pairs symmetric between English and Spanish', () => {
    for (const id of GUIDE_IDS) {
      const en = guideById('en', id);
      const es = guideById('es', id);
      const paths = { en: SEO_PATHS.guide('en', en.slug), es: SEO_PATHS.guide('es', es.slug) };
      for (const page of [en, es]) {
        const meta = pageMetadata({ ...page, paths, type: 'article' });
        expect(meta.alternates?.canonical).toBe(absoluteUrl(paths[page.locale]));
        expect(meta.alternates?.languages).toEqual({
          en: absoluteUrl(paths.en),
          es: absoluteUrl(paths.es),
          'x-default': absoluteUrl(paths.en),
        });
      }
    }
  });
});

describe('SEO hub and showcase', () => {
  for (const locale of SEO_LOCALES) {
    it(`${locale} hub copy is complete`, () => {
      const hub = hubFor(locale);
      expect(hub.locale).toBe(locale);
      expectCopyLimits(hub);
      expectFaq(hub.faq);
      expect(JSON.stringify(hub)).not.toMatch(PLACEHOLDER);
    });

    it(`${locale} showcase only links to paths that exist in the repo`, () => {
      const showcase = showcaseFor(locale);
      expect(showcase.locale).toBe(locale);
      expectCopyLimits(showcase);
      expectFaq(showcase.faq);
      expectTables(showcase.sections);
      expect(showcase.groups.map((group) => group.id)).toEqual(['design-systems', 'design-templates', 'skills', 'plugins', 'craft']);
      for (const item of showcase.groups.flatMap((group) => group.items)) {
        expect(existsSync(resolve(REPO_ROOT, item.path)), item.path).toBe(true);
      }
      expect(JSON.stringify(showcase)).not.toMatch(PLACEHOLDER);
    });
  }

  it('showcase groups match across locales', () => {
    const en = showcaseFor('en').groups.map((group) => group.items.map((item) => item.path));
    const es = showcaseFor('es').groups.map((group) => group.items.map((item) => item.path));
    expect(es).toEqual(en);
  });

  it('sitemap lists every page once with both language alternates', () => {
    const entries = sitemapEntries();
    expect(entries).toHaveLength(2 * (GUIDE_IDS.length + 2));
    expect(new Set(entries.map((entry) => entry.path)).size).toBe(entries.length);
    for (const entry of entries) expect(Object.values(entry.alternates)).toContain(entry.path);
  });
});
