import { useState } from 'react';
import type { WorkspaceCollabContext } from '@open-design/contracts';
import type { DesignSystemSummary, Project } from '../types';
import { GruiaStylePicker } from './GruiaStylePicker';
import { GruiaIdentityReview } from './GruiaIdentityReview';
import styles from './GruiaDesignWorkflow.module.css';

export type GruiaDesignStage = 'style' | 'prototype' | 'identity';
const STAGES = [{ id: 'style', title: 'Elegir estilo' }, { id: 'prototype', title: 'Probar prototipos' }, { id: 'identity', title: 'Crear identidad' }] as const;

export function GruiaDesignWorkflow({ stage, onStageChange, systems, loading, selectedId, onSelect, projects, onPreparePrompt, onOpenProject, workspaceContext }: {
  stage: GruiaDesignStage; onStageChange: (stage: GruiaDesignStage) => void;
  systems: DesignSystemSummary[]; loading: boolean; selectedId: string | null; onSelect: (id: string) => void;
  projects: Project[]; onPreparePrompt: (prompt: string) => void;
  onOpenProject: (id: string, fileName?: string) => void; workspaceContext: WorkspaceCollabContext | null;
}) {
  const [brand, setBrand] = useState('');
  const selected = systems.find((system) => system.id === selectedId);
  function prepare(kind: string) {
    onPreparePrompt(`Crea un prototipo interactivo de ${kind} para ${brand.trim() || 'una marca B2B'}. Usa el sistema de diseño ${selected?.title ?? 'seleccionado'} como dirección visual y adáptalo a una identidad propia. El objetivo es probar estilo, jerarquía, componentes y comportamiento antes de la implementación real en B2BWeb. Incluye estados de interacción, navegación por teclado y versiones móvil y escritorio. Usa datos ficticios y marca las conexiones de formulario como demostración. Entrega HTML autocontenido para probar. Mantén consistentes colores, tipografía, espaciado y componentes para poder extraer después una identidad reutilizable.`);
  }
  return <section className={styles.workflow} aria-labelledby="gruia-workflow-title">
    <header><p className={styles.eyebrow}>Gruia Design</p><h1 id="gruia-workflow-title">Elige el estilo. Prueba la experiencia.</h1>
      <p>Define una identidad a partir de prototipos validados y llévala a B2BWeb para implementar.</p></header>
    <nav className={styles.stages} aria-label="Proceso de diseño">{STAGES.map((item, index) => <button key={item.id} type="button" aria-current={stage === item.id ? 'step' : undefined}
      onClick={() => onStageChange(item.id)}><span>{index + 1}</span>{item.title}</button>)}</nav>
    {stage === 'style' && <><GruiaStylePicker systems={systems} loading={loading} selectedId={selectedId} onSelect={onSelect} />
      <div className={styles.actions}><button type="button" className={styles.primary} disabled={!selected} onClick={() => onStageChange('prototype')}>Probar con {selected?.title ?? 'un estilo'}</button></div></>}
    {stage === 'prototype' && <section className={styles.panel} aria-labelledby="gruia-prototype-title">
      <h2 id="gruia-prototype-title">Prueba una dirección visual</h2><p>Estilo seleccionado: <strong>{selected?.title ?? 'Elige un estilo en el primer paso'}</strong>. Puedes editar el brief antes de generar con Claude.</p>
      <label className={styles.field}>Marca o proyecto<input value={brand} maxLength={160} placeholder="Nombre de la marca" onChange={(event) => setBrand(event.target.value)} /></label>
      <div className={styles.actions}>{['una landing B2B', 'un portal B2B', 'un juego de captación'].map((kind) => <button key={kind} type="button" disabled={!selected} onClick={() => prepare(kind)}>{kind.replace(/^un[ae]? /, '')}</button>)}</div>
      <a href="/community">Explorar casos de B2B, landings y juegos</a>
      <div className={styles.actions}><button type="button" onClick={() => onStageChange('identity')}>Crear identidad de un prototipo</button></div>
      <p>Después de generar, abre el prototipo para probarlo y ajustar el diseño. Cuando esté listo, continúa con «Crear identidad».</p>
    </section>}
    {stage === 'identity' && <GruiaIdentityReview projects={projects} systems={systems} workspaceContext={workspaceContext} onOpenProject={onOpenProject} />}
  </section>;
}
