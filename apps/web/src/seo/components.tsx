import type { ReactNode } from 'react';
import styles from './SeoPage.module.css';
import type { SeoBlock, SeoCta, SeoFaq, SeoGuide, SeoHub, SeoLocale, SeoSection, SeoShowcase } from './types';
import { CONTENT_MODIFIED, DISCORD_URL, DOWNLOAD_URL, REPO_URL, SEO_PATHS, SEO_UI, absoluteUrl, repoTreeUrl } from './site';
import {
  articleJsonLd,
  breadcrumbJsonLd,
  collectionJsonLd,
  faqJsonLd,
  serializeJsonLd,
  type LocalizedPaths,
} from './metadata';
import { readingMinutes } from './registry';

/** Stable, ASCII-only fragment id for a heading. */
export function headingId(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function JsonLd({ nodes }: { nodes: object[] }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is serialised with `<` escaped.
  return <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: serializeJsonLd(nodes) }} />;
}

function Shell({ locale, paths, children }: { locale: SeoLocale; paths: LocalizedPaths; children: ReactNode }) {
  const ui = SEO_UI[locale];
  const other: SeoLocale = locale === 'en' ? 'es' : 'en';
  return (
    <div className={styles.page} lang={locale}>
      <header className={styles.header}>
        <a className={styles.brand} href={SEO_PATHS.hub[locale]}>
          <img src='/app-icon.png' alt='' width={28} height={28} />
          <span>{ui.home}</span>
        </a>
        <nav className={styles.nav} aria-label={ui.home}>
          <a href={SEO_PATHS.hub[locale]}>{ui.guides}</a>
          <a href={SEO_PATHS.showcase[locale]}>{ui.showcase}</a>
          <a href={REPO_URL} rel='noopener'>GitHub</a>
          <a href={paths[other]} hrefLang={other} lang={other} aria-label={ui.switchLanguageLabel}>
            {ui.switchLanguage}
          </a>
        </nav>
      </header>
      {children}
      <footer className={styles.footer}>
        <span>{ui.footer}</span>
        <span className={styles.nav}>
          <a href={REPO_URL} rel='noopener'>GitHub</a>
          <a href={DISCORD_URL} rel='noopener'>{ui.discord}</a>
          <a href={DOWNLOAD_URL} rel='noopener'>open-design.ai</a>
        </span>
      </footer>
    </div>
  );
}

function Breadcrumbs({ trail, label }: { trail: { name: string; path: string }[]; label: string }) {
  return (
    <nav className={styles.breadcrumbs} aria-label={label}>
      <ol>
        {trail.map((crumb, index) => (
          <li key={crumb.path}>
            {index === trail.length - 1 ? <span aria-current='page'>{crumb.name}</span> : <a href={crumb.path}>{crumb.name}</a>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function BlockBody({ block }: { block: SeoBlock }) {
  return (
    <>
      {block.paragraphs?.map((text) => <p key={text}>{text}</p>)}
      {block.bullets ? (
        <ul>
          {block.bullets.map((text) => <li key={text}>{text}</li>)}
        </ul>
      ) : null}
      {block.steps ? (
        <ol>
          {block.steps.map((text) => <li key={text}>{text}</li>)}
        </ol>
      ) : null}
      {block.table ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>{block.table.caption}</caption>
            <thead>
              <tr>
                {block.table.columns.map((column) => <th key={column} scope='col'>{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {block.table.rows.map((row) => (
                <tr key={row.join('|')}>
                  {row.map((cell, index) => (index === 0 ? <th key={`${index}-${cell}`} scope='row'>{cell}</th> : <td key={`${index}-${cell}`}>{cell}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

function Sections({ sections }: { sections: SeoSection[] }) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.heading} aria-labelledby={headingId(section.heading)}>
          <h2 id={headingId(section.heading)}>{section.heading}</h2>
          <BlockBody block={section} />
          {section.subsections?.map((sub) => (
            <div key={sub.heading}>
              <h3 id={headingId(sub.heading)}>{sub.heading}</h3>
              <BlockBody block={sub} />
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

function Faq({ faq, heading }: { faq: SeoFaq[]; heading: string }) {
  return (
    <section className={styles.faq} aria-labelledby='faq'>
      <h2 id='faq'>{heading}</h2>
      {faq.map((item) => (
        <details key={item.question}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </section>
  );
}

function Cta({ cta }: { cta: SeoCta }) {
  return (
    <aside className={styles.cta}>
      <h2>{cta.heading}</h2>
      <p>{cta.body}</p>
      <div className={styles.ctaActions}>
        <a className={styles.ctaPrimary} href={DOWNLOAD_URL} rel='noopener'>{cta.primaryLabel}</a>
        <a className={styles.ctaSecondary} href={REPO_URL} rel='noopener'>{cta.secondaryLabel}</a>
      </div>
    </aside>
  );
}

function Toc({ locale, entries }: { locale: SeoLocale; entries: string[] }) {
  return (
    <nav className={styles.toc} aria-label={SEO_UI[locale].onThisPage}>
      <p>{SEO_UI[locale].onThisPage}</p>
      <ol>
        {entries.map((entry) => (
          <li key={entry}>
            <a href={`#${headingId(entry)}`}>{entry}</a>
          </li>
        ))}
        <li>
          <a href='#faq'>{SEO_UI[locale].faq}</a>
        </li>
      </ol>
    </nav>
  );
}

export function GuidePage({ guide, paths, related }: { guide: SeoGuide; paths: LocalizedPaths; related: SeoGuide[] }) {
  const { locale } = guide;
  const ui = SEO_UI[locale];
  const trail = [
    { name: ui.guides, path: SEO_PATHS.hub[locale] },
    { name: guide.h1, path: paths[locale] },
  ];
  return (
    <Shell locale={locale} paths={paths}>
      <JsonLd nodes={[articleJsonLd(guide), faqJsonLd(guide.faq), breadcrumbJsonLd(trail)]} />
      <div className={styles.layout}>
        <main>
          <article className={styles.prose}>
            <Breadcrumbs trail={trail} label={ui.guides} />
            <p className={styles.eyebrow}>{guide.eyebrow}</p>
            <h1 className={styles.h1}>{guide.h1}</h1>
            <p className={styles.lede}>{guide.lede}</p>
            <div className={styles.meta}>
              <span>{readingMinutes(guide)} {ui.minRead}</span>
              <span>{ui.updated} <time dateTime={CONTENT_MODIFIED}>{CONTENT_MODIFIED}</time></span>
            </div>
            {guide.intro.map((text) => <p key={text}>{text}</p>)}
            <Sections sections={guide.sections} />
            <Faq faq={guide.faq} heading={ui.faq} />
            <Cta cta={guide.cta} />
            <section aria-labelledby='related'>
              <h2 id='related'>{ui.related}</h2>
              <ul>
                {related.map((item) => (
                  <li key={item.id}>
                    <a href={SEO_PATHS.guide(locale, item.slug)}>{item.h1}</a>
                  </li>
                ))}
                <li>
                  <a href={SEO_PATHS.showcase[locale]}>{ui.showcase}</a>
                </li>
              </ul>
            </section>
          </article>
        </main>
        <Toc locale={locale} entries={guide.sections.map((section) => section.heading)} />
      </div>
    </Shell>
  );
}

export function HubPage({ hub, guides, paths }: { hub: SeoHub; guides: SeoGuide[]; paths: LocalizedPaths }) {
  const { locale } = hub;
  const ui = SEO_UI[locale];
  return (
    <Shell locale={locale} paths={paths}>
      <JsonLd
        nodes={[
          collectionJsonLd({
            locale,
            path: paths[locale],
            name: hub.h1,
            description: hub.description,
            items: guides.map((guide) => ({ name: guide.h1, url: absoluteUrl(SEO_PATHS.guide(locale, guide.slug)) })),
          }),
          faqJsonLd(hub.faq),
          breadcrumbJsonLd([{ name: ui.guides, path: paths[locale] }]),
        ]}
      />
      <main className={styles.single}>
        <div className={styles.prose}>
          <p className={styles.eyebrow}>{hub.eyebrow}</p>
          <h1 className={styles.h1}>{hub.h1}</h1>
          <p className={styles.lede}>{hub.lede}</p>
          {hub.intro.map((text) => <p key={text}>{text}</p>)}
        </div>
        <h2 className={styles.prose}>{ui.allGuides}</h2>
        <div className={styles.grid}>
          {guides.map((guide) => (
            <a key={guide.id} className={styles.card} href={SEO_PATHS.guide(locale, guide.slug)}>
              <h3>{guide.h1}</h3>
              <p>{guide.description}</p>
              <span className={styles.tags}>
                <span className={styles.tag}>{readingMinutes(guide)} {ui.minRead}</span>
              </span>
            </a>
          ))}
        </div>
        <div className={styles.prose}>
          <Faq faq={hub.faq} heading={ui.faq} />
          <Cta cta={hub.cta} />
        </div>
      </main>
    </Shell>
  );
}

export function ShowcasePage({ showcase, paths }: { showcase: SeoShowcase; paths: LocalizedPaths }) {
  const { locale } = showcase;
  const ui = SEO_UI[locale];
  const items = showcase.groups.flatMap((group) => group.items);
  return (
    <Shell locale={locale} paths={paths}>
      <JsonLd
        nodes={[
          collectionJsonLd({
            locale,
            path: paths[locale],
            name: showcase.h1,
            description: showcase.description,
            items: items.map((item) => ({ name: item.name, url: repoTreeUrl(item.path) })),
          }),
          faqJsonLd(showcase.faq),
          breadcrumbJsonLd([{ name: ui.showcase, path: paths[locale] }]),
        ]}
      />
      <main className={styles.single}>
        <div className={styles.prose}>
          <p className={styles.eyebrow}>{showcase.eyebrow}</p>
          <h1 className={styles.h1}>{showcase.h1}</h1>
          <p className={styles.lede}>{showcase.lede}</p>
          {showcase.intro.map((text) => <p key={text}>{text}</p>)}
        </div>
        {showcase.groups.map((group) => (
          <section key={group.id} aria-labelledby={group.id}>
            <h2 id={group.id} className={styles.prose}>{group.heading}</h2>
            <p className={styles.groupIntro}>{group.intro}</p>
            <div className={styles.grid}>
              {group.items.map((item) => (
                <a key={item.path} className={styles.card} href={repoTreeUrl(item.path)} rel='noopener'>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <span className={styles.tags}>
                    {item.tags.map((tag) => <span key={tag} className={styles.tag}>{tag}</span>)}
                  </span>
                </a>
              ))}
            </div>
          </section>
        ))}
        <div className={styles.prose}>
          <Sections sections={showcase.sections} />
          <Faq faq={showcase.faq} heading={ui.faq} />
          <Cta cta={showcase.cta} />
        </div>
      </main>
    </Shell>
  );
}
