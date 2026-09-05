import { useEffect, useRef, useState } from 'react';
import type { WorkspaceCollabContext } from '@open-design/contracts';
import type { DesignSystemSummary, Project, ProjectFile } from '../types';
import { fetchDesignSystem, fetchProjectFiles, fetchProjectFileText, projectFileUrl, writeProjectTextFileDetailed } from '../providers/registry';
import { buildIdentity, COLOR_ROLES, IDENTITY_SCHEMA, identityGuide, identityMatchesPrototype, parseIdentity, proposeIdentity, prototypeDigest, validateIdentityForm, type B2BWebIdentity, type IdentityForm } from '../state/gruia-identity';
import styles from './GruiaDesignWorkflow.module.css';

const COLOR_LABELS = { primary: 'Principal', secondary: 'Secundario', accent: 'Acento', background: 'Fondo', text: 'Texto', muted: 'Texto secundario' };
const IDENTITY_FILE = /^gruia-identity-[\w-]+\.json$/;

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function GruiaIdentityReview({ projects, systems, workspaceContext, onOpenProject }: {
  projects: Project[]; systems: DesignSystemSummary[]; workspaceContext: WorkspaceCollabContext | null;
  onOpenProject: (id: string, fileName?: string) => void;
}) {
  const operationScope = useRef(0);
  useEffect(() => { operationScope.current += 1; return () => { operationScope.current += 1; }; }, [workspaceContext]);
  const [projectId, setProjectId] = useState('');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [fileName, setFileName] = useState('');
  const [html, setHtml] = useState('');
  const [digest, setDigest] = useState('');
  const [guide, setGuide] = useState('');
  const [form, setForm] = useState<IdentityForm | null>(null);
  const [saved, setSaved] = useState<B2BWebIdentity | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const project = projects.find((item) => item.id === projectId);
  const system = systems.find((item) => item.id === project?.designSystemId);

  useEffect(() => {
    let cancelled = false;
    setFiles([]); setFileName(''); setForm(null); setSaved(null); setHtml(''); setDigest(''); setError(''); setNotice('');
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    void fetchProjectFiles(projectId, { fresh: true, requireAuthoritative: true, workspaceContext }).then((next) => {
      if (cancelled) return;
      setFiles(next); setFileName(next.find((file) => /\.html?$/i.test(file.name))?.name ?? '');
    }).catch(() => { if (!cancelled) setError('No se han podido cargar los archivos del prototipo.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, workspaceContext, refresh]);

  useEffect(() => {
    let cancelled = false;
    setForm(null); setSaved(null); setReviewed(false); setDirty(false); setHtml(''); setDigest(''); setError('');
    if (!project || !fileName) return;
    setLoading(true);
    void (async () => {
      const [source, design, versions] = await Promise.all([
        fetchProjectFileText(project.id, fileName, { cache: 'no-store', workspaceContext }),
        project.designSystemId ? fetchDesignSystem(project.designSystemId, workspaceContext) : Promise.resolve(null),
        Promise.all(files.filter((file) => IDENTITY_FILE.test(file.name)).sort((a, b) => b.mtime - a.mtime).slice(0, 20)
          .map((file) => fetchProjectFileText(project.id, file.name, { cache: 'no-store', workspaceContext }))),
      ]);
      if (source === null) throw new Error('No se ha podido leer el prototipo.');
      const nextDigest = await prototypeDigest(source);
      if (cancelled) return;
      const verifiedVersions = await Promise.all(versions.map(async (value) => {
        const identity = value ? parseIdentity(value) : null;
        return identity && await prototypeDigest(identity.branding.gruiaDesign.prototypeHtml) === identity.branding.gruiaDesign.prototypeSha256 ? identity : null;
      }));
      if (cancelled) return;
      const previous = verifiedVersions.find((value) => value
        && value.branding.gruiaDesign.projectId === project.id && value.branding.gruiaDesign.prototypeFile === fileName) ?? null;
      setHtml(source); setDigest(nextDigest); setGuide(design?.body ?? ''); setSaved(previous);
      setForm(previous ? { ...previous.branding, name: previous.name, description: previous.description }
        : proposeIdentity(source, project.name, design?.swatches));
      setReviewed(Boolean(previous && identityMatchesPrototype(previous, project.id, fileName, nextDigest)));
    })().catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'No se ha podido abrir el prototipo.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project?.id, project?.name, project?.designSystemId, fileName, files, workspaceContext]);

  function edit(next: IdentityForm) { setForm(next); setDirty(true); setReviewed(false); setNotice(''); }
  async function assertCurrent() {
    const scope = operationScope.current;
    const current = await fetchProjectFileText(projectId, fileName, { cache: 'no-store', cacheBustKey: Date.now(), workspaceContext });
    const currentDigest = current === null ? null : await prototypeDigest(current);
    if (scope !== operationScope.current) throw new Error('La sesión ha cambiado. Vuelve a abrir el proyecto.');
    if (currentDigest !== digest) {
      setReviewed(false); setDirty(true);
      throw new Error('El prototipo ha cambiado. Actualiza la vista previa y revisa la nueva versión.');
    }
  }
  async function save() {
    if (!project || !form || !reviewed) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await assertCurrent();
      const identity = buildIdentity(form, {
        schema: IDENTITY_SCHEMA, projectId, projectName: project.name, prototypeFile: fileName, prototypeSha256: digest, prototypeHtml: html,
        designSystemId: project.designSystemId ?? null, designSystemName: system?.title ?? null,
        designGuide: guide, approvedAt: new Date().toISOString(),
      });
      const name = `gruia-identity-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.json`;
      const result = await writeProjectTextFileDetailed(projectId, name, JSON.stringify(identity, null, 2), undefined, workspaceContext);
      if (!result.ok) throw new Error(result.message);
      setFiles((current) => [...current, result.file]);
      setSaved(identity); setDirty(false); setNotice('Identidad guardada en el proyecto. Ya puedes descargarla para B2BWeb.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se ha podido guardar la identidad.'); }
    finally { setBusy(false); }
  }
  async function exportIdentity(kind: 'json' | 'guide' | 'prototype') {
    if (!saved || dirty) return;
    setBusy(true); setError('');
    try {
      await assertCurrent();
      if (!identityMatchesPrototype(saved, projectId, fileName, digest)) throw new Error('Crea una identidad para esta versión del prototipo.');
      download(kind === 'json' ? 'b2bweb-identity.json' : kind === 'prototype' ? 'prototipo-aprobado.html' : 'IDENTIDAD.md',
        kind === 'json' ? JSON.stringify(saved, null, 2) : kind === 'prototype' ? saved.branding.gruiaDesign.prototypeHtml : identityGuide(saved), kind === 'json' ? 'application/json' : kind === 'prototype' ? 'text/html' : 'text/markdown');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se ha podido descargar la identidad.'); }
    finally { setBusy(false); }
  }
  const canExport = Boolean(saved && reviewed && !dirty && identityMatchesPrototype(saved, projectId, fileName, digest));

  return <section className={styles.panel} aria-labelledby="gruia-identity-title">
    <h2 id="gruia-identity-title">Del prototipo a la identidad</h2>
    <p>Prueba la experiencia, revisa las decisiones visuales y guarda una identidad para la implementación en B2BWeb.</p>
    <label className={styles.field}>Proyecto<select aria-label="Proyecto" value={projectId} disabled={busy} onChange={(event) => setProjectId(event.target.value)}>
      <option value="">Selecciona un proyecto</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {!projects.length && <p>Crea primero un prototipo en el paso anterior.</p>}
    {projectId && <label className={styles.field}>Prototipo<select aria-label="Prototipo" value={fileName} disabled={busy || loading} onChange={(event) => { setNotice(''); setFileName(event.target.value); }}>
      <option value="">Selecciona un archivo HTML</option>{files.filter((file) => /\.html?$/i.test(file.name)).map((file) => <option key={file.name} value={file.name}>{file.name}</option>)}
    </select></label>}
    {loading && <p role="status">Cargando prototipo e identidad…</p>}
    {projectId && !loading && !fileName && <p>Este proyecto aún no tiene un prototipo HTML. Puedes abrirlo para continuar el diseño.</p>}
    {project && <div className={styles.actions}><button type="button" onClick={() => onOpenProject(project.id, fileName || undefined)}>Abrir y editar proyecto</button>
      <button type="button" disabled={busy || loading} onClick={() => setRefresh((value) => value + 1)}>Actualizar vista previa</button></div>}
    {html && form && <>
      <div className={styles.actions} aria-label="Tamaño de vista previa">
        <button type="button" aria-pressed={!mobile} onClick={() => setMobile(false)}>Escritorio</button>
        <button type="button" aria-pressed={mobile} onClick={() => setMobile(true)}>Móvil</button>
      </div>
      <div className={styles.previewGround}><iframe title="Prototipo interactivo" className={mobile ? styles.mobilePreview : styles.preview}
        src={`${projectFileUrl(projectId, fileName, workspaceContext)}${projectFileUrl(projectId, fileName, workspaceContext).includes('?') ? '&' : '?'}gruiaRevision=${digest}`}
        sandbox="allow-scripts" /></div>
      <p className={styles.note}>Referencia: {system?.title ?? 'Estilo propio del prototipo'}. Los colores y fuentes son una propuesta extraída del archivo; revísalos antes de aprobar.</p>
      <fieldset className={styles.form} disabled={busy}><legend>Identidad para B2BWeb</legend>
        <label className={styles.field}>Nombre de la identidad<input maxLength={255} value={form.name} onChange={(event) => edit({ ...form, name: event.target.value })} /></label>
        <label className={styles.field}>Reglas de implementación<textarea rows={3} value={form.description} placeholder="Tono visual, componentes, estados y comportamientos que se deben conservar" onChange={(event) => edit({ ...form, description: event.target.value })} /></label>
        <div className={styles.colors}>{COLOR_ROLES.map((role) => <label key={role} className={styles.color}>{COLOR_LABELS[role]}
          <input type="color" value={form.colors[role]} onChange={(event) => edit({ ...form, colors: { ...form.colors, [role]: event.target.value } })} />
          <span>{form.colors[role]}</span></label>)}</div>
        <div className={styles.formRow}>{(['heading', 'body'] as const).map((role) => <label key={role} className={styles.field}>{role === 'heading' ? 'Tipografía de títulos' : 'Tipografía de texto'}
          <input maxLength={120} value={form.fonts[role]} onChange={(event) => edit({ ...form, fonts: { ...form.fonts, [role]: event.target.value } })} /></label>)}</div>
        <div className={styles.formRow}><label className={styles.field}>Esquinas<select value={form.borderRadius} onChange={(event) => edit({ ...form, borderRadius: event.target.value as IdentityForm['borderRadius'] })}>
          <option value="none">Rectas</option><option value="sm">Suaves</option><option value="md">Medias</option><option value="lg">Redondeadas</option><option value="full">Cápsula</option></select></label>
          <label className={styles.field}>Espaciado<select value={form.spacing} onChange={(event) => edit({ ...form, spacing: event.target.value as IdentityForm['spacing'] })}>
            <option value="compact">Compacto</option><option value="normal">Normal</option><option value="relaxed">Amplio</option></select></label></div>
        <label className={styles.confirm}><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /><span>He probado el prototipo y revisado esta identidad.</span></label>
        <div className={styles.actions}><button type="button" className={styles.primary} disabled={!reviewed || Boolean(validateIdentityForm(form))} onClick={() => void save()}>Guardar identidad aprobada</button></div>
      </fieldset>
      {saved && !canExport && <p role="status">Hay cambios pendientes de aprobar para esta identidad.</p>}
      {canExport && <div className={styles.actions}><button type="button" disabled={busy} className={styles.primary} onClick={() => void exportIdentity('json')}>Descargar identidad B2BWeb</button>
        <button type="button" disabled={busy} onClick={() => void exportIdentity('prototype')}>Descargar código del ejemplo</button>
        <button type="button" disabled={busy} onClick={() => void exportIdentity('guide')}>Descargar guía de implementación</button></div>}
      <p className={styles.note}>El archivo de identidad incluye el HTML del ejemplo aprobado y utiliza el formato de versiones de estilo de B2BWeb. Su incorporación y activación se realizan allí.</p>
    </>}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
