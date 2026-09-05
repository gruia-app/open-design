import { useMemo, useState } from 'react';
import styles from './GruiaExamples.module.css';
import { GRUIA_EXAMPLE_CATEGORIES, GRUIA_EXAMPLES, type GruiaExampleCategory } from './gruia-examples';

export interface GruiaExamplesProps {
  onUsePrompt: (example: { id: string; prompt: string }) => void;
}

export function GruiaExamples({ onUsePrompt }: GruiaExamplesProps) {
  const [category, setCategory] = useState<'Todos' | GruiaExampleCategory>('Todos');
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = useMemo(() => GRUIA_EXAMPLES.filter((example) => {
    const categoryMatch = category === 'Todos' || example.category === category;
    const searchable = [example.title, example.description, example.output, example.category, ...example.tags].join(' ').toLocaleLowerCase();
    return categoryMatch && (!normalizedQuery || searchable.includes(normalizedQuery));
  }), [category, normalizedQuery]);

  if (process.env.NEXT_PUBLIC_GRUIA_MANAGED !== '1') return null;

  return (
    <section className={styles.section} aria-labelledby="gruia-examples-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Selección Gruia</p>
          <h2 id="gruia-examples-title">9 ideas listas para prototipar</h2>
          <p>Elige un caso, prueba los ejemplos y adapta su brief con Claude. Inspirados en recursos de OpenDesign.</p>
        </div>
      </div>
      <div className={styles.tools}>
        <label className="sr-only" htmlFor="gruia-examples-search">Buscar ejemplos</label>
        <input id="gruia-examples-search" className={styles.search} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por caso, interacción o etiqueta" />
        <div className={styles.filters} role="group" aria-label="Filtrar ejemplos por categoría">
          {GRUIA_EXAMPLE_CATEGORIES.map((item) => (
            <button key={item} type="button" className={`${styles.filter} ${category === item ? styles.filterActive : ''}`} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>
      </div>
      {visible.length > 0 ? (
        <div className={styles.grid}>
          {visible.map((example) => (
            <article key={example.id} className={styles.card}>
              <div className={styles.body}>
                <span className={styles.category}>{example.category}</span>
                <h3 className={styles.title}>{example.title}</h3>
                <p className={styles.description}>{example.description}</p>
                <p className={styles.output}><strong>Qué genera:</strong> {example.output}</p>
                <div className={styles.tags} aria-label="Etiquetas">{example.tags.map((tag) => <span key={tag} className={styles.tag}>{tag}</span>)}</div>
              </div>
              <div className={styles.actions}>
                <a className={styles.source} href={example.sourceUrl} target="_blank" rel="noreferrer" title={`${example.sourceLabel}. ${example.attribution}`}>Referencia OpenDesign ↗</a>
                {example.previewUrl ? <a className={styles.source} href={example.previewUrl} target="_blank" rel="noreferrer">Ver ejemplo ↗</a> : null}
                <button type="button" className={styles.use} onClick={() => onUsePrompt({ id: example.id, prompt: example.prompt })}>Usar prompt</button>
              </div>
            </article>
          ))}
        </div>
      ) : <p className={styles.empty}>No hay ejemplos que coincidan. Prueba otra búsqueda o “Todos”.</p>}
    </section>
  );
}
