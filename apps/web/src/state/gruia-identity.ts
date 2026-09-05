export const IDENTITY_SCHEMA = 'gruia-design-identity/v1';
export const COLOR_ROLES = ['primary', 'secondary', 'accent', 'background', 'text', 'muted'] as const;
export type ColorRole = typeof COLOR_ROLES[number];
export interface IdentityForm {
  name: string;
  description: string;
  colors: Record<ColorRole, string>;
  fonts: { heading: string; body: string };
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  spacing: 'compact' | 'normal' | 'relaxed';
}
export interface IdentitySource {
  schema: typeof IDENTITY_SCHEMA;
  projectId: string;
  projectName: string;
  prototypeFile: string;
  prototypeSha256: string;
  prototypeHtml: string;
  designSystemId: string | null;
  designSystemName: string | null;
  designGuide: string;
  approvedAt: string;
}
/** Exact StyleVersionCreate payload accepted by B2BWeb's styles API. */
export interface B2BWebIdentity {
  name: string;
  description: string;
  branding: Omit<IdentityForm, 'name' | 'description'> & { gruiaDesign: IdentitySource };
}

export function validateIdentityForm(form: IdentityForm): string | null {
  if (!form.name.trim() || form.name.trim().length > 255) return 'Escribe un nombre de identidad de hasta 255 caracteres.';
  if (!COLOR_ROLES.every((role) => /^#[a-f\d]{6}$/i.test(form.colors[role]))) return 'Revisa los seis colores de la identidad.';
  if (![form.fonts.heading, form.fonts.body].every((font) => font.trim().length > 0 && /^[\p{L}\p{N} ,.'-]{1,120}$/u.test(font))) return 'Revisa las familias tipográficas.';
  if (!['none', 'sm', 'md', 'lg', 'full'].includes(form.borderRadius)) return 'Elige el acabado de las esquinas.';
  if (!['compact', 'normal', 'relaxed'].includes(form.spacing)) return 'Elige el espaciado.';
  return null;
}

export function buildIdentity(form: IdentityForm, source: IdentitySource): B2BWebIdentity {
  const error = validateIdentityForm(form);
  if (error) throw new Error(error);
  if (!source.projectId || !source.prototypeFile || typeof source.prototypeHtml !== 'string' || !source.prototypeHtml.trim() || !/^[a-f\d]{64}$/.test(source.prototypeSha256)
    || !Number.isFinite(Date.parse(source.approvedAt))) throw new Error('Falta el prototipo revisado.');
  return {
    name: form.name.trim(), description: form.description.trim(),
    branding: {
      colors: { ...form.colors }, fonts: { ...form.fonts },
      borderRadius: form.borderRadius, spacing: form.spacing,
      gruiaDesign: { ...source, schema: IDENTITY_SCHEMA },
    },
  };
}

export function parseIdentity(raw: string): B2BWebIdentity | null {
  try {
    const value = JSON.parse(raw) as B2BWebIdentity;
    if (value.branding?.gruiaDesign?.schema !== IDENTITY_SCHEMA) return null;
    return buildIdentity({ ...value.branding, name: value.name, description: value.description }, value.branding.gruiaDesign);
  } catch { return null; }
}

export function identityMatchesPrototype(identity: B2BWebIdentity, projectId: string, file: string, digest: string): boolean {
  const source = identity.branding.gruiaDesign;
  return source.projectId === projectId && source.prototypeFile === file && source.prototypeSha256 === digest;
}

export async function prototypeDigest(html: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(html));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Parse declarations only. Prototype scripts never execute in the host page. */
export function proposeIdentity(html: string, name: string, swatches: readonly string[] = []): IdentityForm {
  const css = Array.from(html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi), (match) => match[1]).join('\n');
  const variables = new Map(Array.from(css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g), (match) => [match[1]!, match[2]!.trim()]));
  function color(value: string | undefined): string | null {
    if (!value) return null;
    for (let i = 0; i < 4 && value.includes('var('); i++) value = value.replace(/var\((--[\w-]+)\)/g, (_all, key: string) => variables.get(key) ?? '');
    if (/^#[a-f\d]{6}$/i.test(value)) return value.toLowerCase();
    if (/^#[a-f\d]{3}$/i.test(value)) return '#' + value.slice(1).split('').map((c) => c + c).join('');
    if (typeof CSS === 'undefined' || !CSS.supports('color', value)) return null;
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.fillStyle = value; context.fillRect(0, 0, 1, 1);
    const pixel = context.getImageData(0, 0, 1, 1).data;
    if (pixel[3] !== 255) return null;
    return '#' + Array.from(pixel.slice(0, 3), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  function pick(keys: string[], fallback: string): string {
    for (const key of keys) { const found = color(variables.get(key)); if (found) return found; }
    return color(fallback) ?? '#353535';
  }
  function font(keys: string[]): string {
    for (const key of keys) {
      const found = variables.get(key)?.replace(/["']/g, '').split(',')[0]?.trim();
      if (found && /^[\p{L}\p{N} .-]{1,120}$/u.test(found)) return found;
    }
    return 'system-ui';
  }
  return {
    name, description: '',
    colors: {
      primary: pick(['--primary', '--accent', '--brand'], swatches[0] ?? '#353535'),
      secondary: pick(['--secondary', '--accent-2'], swatches[1] ?? '#5c5c5c'),
      accent: pick(['--accent', '--primary', '--brand'], swatches[0] ?? '#353535'),
      background: pick(['--bg', '--background', '--paper', '--surface'], '#fafafa'),
      text: pick(['--text', '--fg', '--ink', '--text-strong'], '#202020'),
      muted: pick(['--muted', '--text-muted'], '#5c5c5c'),
    },
    fonts: { heading: font(['--font-heading', '--font-display', '--serif']), body: font(['--font-body', '--sans', '--font-sans']) },
    borderRadius: 'md', spacing: 'normal',
  };
}

export function identityGuide(identity: B2BWebIdentity): string {
  const { branding } = identity;
  const source = branding.gruiaDesign;
  return `# ${identity.name}\n\n${identity.description}\n\n## Identidad visual\n\n${COLOR_ROLES.map((role) => `- ${role}: ${branding.colors[role]}`).join('\n')}\n- Tipografía de títulos: ${branding.fonts.heading}\n- Tipografía de texto: ${branding.fonts.body}\n- Esquinas: ${branding.borderRadius}\n- Espaciado: ${branding.spacing}\n\n## Prototipo aprobado\n\nProyecto: ${source.projectName}\nArchivo: ${source.prototypeFile}\nSHA-256: ${source.prototypeSha256}\nAprobación: ${source.approvedAt}\nEstilo de referencia: ${source.designSystemName ?? 'Personalizado'}\n\n## Implementación en B2BWeb\n\nEl JSON incluye el código HTML del ejemplo aprobado en branding.gruiaDesign.prototypeHtml, junto a su archivo y SHA-256. Revisar ese código como referencia de diseño e interacción. La descarga de ejemplo HTML contiene la misma versión.\n\nEl JSON adjunto es el cuerpo de creación de una versión de estilo:\nPOST /api/v1/websites/{website_id}/styles\n\nUsar la sesión de un miembro y el website de su organización. El resultado queda inactivo; revisar y activar desde B2BWeb cuando corresponda. Aplicar las reglas visuales y reproducir los comportamientos del prototipo con los componentes reales. Conectar formularios y datos a los servicios de B2BWeb.\n\n## Guía del estilo de referencia\n\n${source.designGuide}\n`;
}
