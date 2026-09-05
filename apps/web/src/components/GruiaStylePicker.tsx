import { useMemo, useState } from 'react';
import type { DesignSystemSummary } from '../types';
import styles from './GruiaStylePicker.module.css';

interface GruiaStylePickerProps {
  systems: DesignSystemSummary[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}

const INITIAL_COUNT = 12;

function isCssColor(value: string): boolean {
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', value);
  }
  return /^(#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})|(?:rgb|hsl)a?\([^)]*\)|[a-z]+)$/i.test(value.trim());
}

function swatchesFor(system: DesignSystemSummary): string[] {
  return (system.swatches ?? []).filter((swatch) => isCssColor(swatch)).slice(0, 5);
}

export function GruiaStylePicker({ systems, selectedId, loading, onSelect }: GruiaStylePickerProps) {
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);

  const filteredSystems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return systems;
    return systems.filter((system) =>
      [system.title, system.category, system.summary].some((value) =>
        value.toLocaleLowerCase().includes(needle),
      ),
    );
  }, [query, systems]);

  const visibleSystems = filteredSystems.slice(0, visibleCount);
  const comparisonSystems = comparisonIds
    .map((id) => systems.find((system) => system.id === id))
    .filter((system): system is DesignSystemSummary => Boolean(system));

  const toggleComparison = (id: string) => {
    setComparisonIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 3
          ? [...current, id]
          : current,
    );
  };

  return (
    <section className={styles.root} aria-labelledby="gruia-style-picker-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Identidad visual</p>
          <h2 id="gruia-style-picker-title">Elige un estilo para empezar</h2>
          <p className={styles.intro}>Compara referencias y selecciona la dirección que probarás en tu prototipo.</p>
        </div>
        <label className={styles.searchLabel}>
          <span>Buscar estilos</span>
          <input
            className={styles.search}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCount(INITIAL_COUNT);
            }}
            placeholder="Título, categoría o resumen"
          />
        </label>
      </header>

      {loading ? (
        <div className={styles.state} role="status">Cargando estilos…</div>
      ) : systems.length === 0 ? (
        <div className={styles.state}>Aún no hay estilos disponibles.</div>
      ) : filteredSystems.length === 0 ? (
        <div className={styles.state}>No encontramos estilos con esa búsqueda.</div>
      ) : (
        <>
          <div className={styles.list} role="list" aria-label="Estilos disponibles">
            {visibleSystems.map((system) => {
              const selected = system.id === selectedId;
              const compared = comparisonIds.includes(system.id);
              const swatches = swatchesFor(system);
              return (
                <article className={`${styles.row} ${selected ? styles.selected : ''}`} key={system.id} role="listitem">
                  <div className={styles.swatches} aria-hidden="true">
                    {swatches.length ? swatches.map((swatch, index) => <span className={styles.swatch} style={{ backgroundColor: swatch }} key={`${swatch}-${index}`} />) : <span className={styles.noSwatch} />}
                  </div>
                  <div className={styles.details}>
                    <div className={styles.meta}>{system.category || 'Sin categoría'}</div>
                    <h3>{system.title}</h3>
                    <p>{system.summary?.startsWith('Bundled OpenDesign package') ? 'Referencia de color, tipografía y componentes.' : system.summary || 'Explora los colores, la tipografía y los componentes de este estilo.'}</p>
                  </div>
                  <div className={styles.actions}>
                    <button type="button" className={styles.selectButton} aria-pressed={selected} onClick={() => onSelect(system.id)}>
                      {selected ? 'Seleccionado' : 'Elegir'}
                    </button>
                    <button type="button" className={styles.compareButton} aria-pressed={compared} onClick={() => toggleComparison(system.id)} disabled={!compared && comparisonIds.length >= 3}>
                      {compared ? 'Comparando' : 'Comparar'}
                    </button>
                    <a className={styles.link} href={`/design-systems/${encodeURIComponent(system.id)}`}>Abrir estilo</a>
                  </div>
                </article>
              );
            })}
          </div>
          {visibleCount < filteredSystems.length ? (
            <button type="button" className={styles.loadMore} onClick={() => setVisibleCount((count) => count + INITIAL_COUNT)}>Cargar más estilos</button>
          ) : null}
        </>
      )}

      {comparisonSystems.length > 0 ? (
        <section className={styles.comparison} aria-labelledby="gruia-comparison-title">
          <div className={styles.comparisonHead}>
            <div><p className={styles.eyebrow}>Vista lado a lado</p><h2 id="gruia-comparison-title">Comparar estilos <span>({comparisonSystems.length}/3)</span></h2></div>
            <p className={styles.comparisonHint}>Comparar no cambia tu selección.</p>
          </div>
          <div className={styles.frames}>
            {comparisonSystems.map((system) => (
              <article className={styles.frameCard} key={system.id}>
                <div className={styles.frameToolbar}><strong>{system.title}</strong><button type="button" onClick={() => toggleComparison(system.id)} aria-label={`Quitar ${system.title} de la comparación`}>Quitar</button></div>
                <iframe title={`Vista previa de ${system.title}`} loading="lazy" sandbox="allow-scripts" src={`/api/design-systems/${encodeURIComponent(system.id)}/showcase`} />
                <button type="button" className={styles.frameChoose} onClick={() => onSelect(system.id)} aria-label={`Elegir ${system.title}`}>Elegir este estilo</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

export type { GruiaStylePickerProps };
