import { describe, expect, it } from 'vitest';
import { buildIdentity, IDENTITY_SCHEMA, identityMatchesPrototype, parseIdentity, proposeIdentity, prototypeDigest, validateIdentityForm } from '../../src/state/gruia-identity';

const html = '<style>:root { --brand: #abc; --primary: var(--brand); --bg: #ffffff; --font-heading: "Inter", sans-serif; }</style><button>Demo</button>';
const source = { schema: IDENTITY_SCHEMA, projectId: 'project-1', projectName: 'Demo', prototypeFile: 'index.html', prototypeHtml: html, prototypeSha256: 'a'.repeat(64), designSystemId: 'linear', designSystemName: 'Linear', designGuide: 'Use restrained spacing.', approvedAt: '2026-09-05T12:00:00Z' } as const;
describe('Gruia identity handoff', () => {
  it('exports the existing B2BWeb style creation body and preserves provenance', () => {
    const identity = buildIdentity(proposeIdentity(html, ' Demo '), source);
    expect(Object.keys(identity)).toEqual(['name', 'description', 'branding']);
    expect(identity.name).toBe('Demo');
    expect(identity.branding.colors.primary).toBe('#aabbcc');
    expect(identity.branding.fonts.heading).toBe('Inter');
    expect(identity.branding.gruiaDesign).toEqual(source);
    expect(identity.branding.gruiaDesign.prototypeHtml).toBe(html);
    expect(parseIdentity(JSON.stringify(identity))).toEqual(identity);
  });
  it('rejects malformed imports, CSS injection and incomplete approval sources', () => {
    const form = proposeIdentity(html, 'Demo');
    expect(parseIdentity('{')).toBeNull();
    expect(parseIdentity(JSON.stringify({ name: 'Demo', branding: {} }))).toBeNull();
    expect(validateIdentityForm({ ...form, fonts: { heading: 'Inter; color:red', body: 'Inter' } })).toBeTruthy();
    expect(validateIdentityForm({ ...form, colors: { ...form.colors, primary: 'red' } })).toBeTruthy();
    expect(() => buildIdentity(form, { ...source, prototypeSha256: '' })).toThrow();
  });
  it('ties approval to both project, file and exact prototype contents', async () => {
    const digest = await prototypeDigest(html);
    const identity = buildIdentity(proposeIdentity(html, 'Demo'), { ...source, prototypeSha256: digest });
    expect(identityMatchesPrototype(identity, 'project-1', 'index.html', digest)).toBe(true);
    expect(identityMatchesPrototype(identity, 'project-2', 'index.html', digest)).toBe(false);
    expect(identityMatchesPrototype(identity, 'project-1', 'other.html', digest)).toBe(false);
    expect(identityMatchesPrototype(identity, 'project-1', 'index.html', await prototypeDigest(html + 'changed'))).toBe(false);
  });
});
