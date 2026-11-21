import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

// The Web Clipper is not part of the pnpm workspace, so its dictionary in
// `clipper/i18n.js` falls back to English per key without any type check. A
// missing override silently shows English, and a translated string that drops
// or renames a `{placeholder}` or an HTML tag breaks the popup at runtime.
// This test reads the shipped file as a resource and pins both properties.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const clipperDir = join(repoRoot, "clipper");

// Locales that must be complete: every English key has its own translation.
const COMPLETE_LOCALES = ["es-ES", "fr", "de", "pt-BR", "it", "nl", "ja"];

type Dict = Record<string, string>;

function loadClipperDictionaries(): { en: Dict; overrides: Record<string, Dict> } {
  const source = readFileSync(join(clipperDir, "i18n.js"), "utf8");
  const marker = "const dicts = {};";
  expect(source).toContain(marker);
  const sandbox: Record<string, unknown> = {};
  sandbox.globalThis = sandbox;
  runInNewContext(source.replace(marker, `globalThis.__clipperI18n = { en, overrides };${marker}`), sandbox);
  return sandbox.__clipperI18n as { en: Dict; overrides: Record<string, Dict> };
}

function placeholderNames(value: string): string {
  return [...value.matchAll(/\{(\w+)(?=[,}])/g)].map((m) => m[1]).sort().join("|");
}

function htmlTags(value: string): string {
  return [...value.matchAll(/<\/?([a-z][a-z0-9]*)\b/gi)].map((m) => m[1]!.toLowerCase()).sort().join("|");
}

describe("clipper i18n integrity", () => {
  const { en, overrides } = loadClipperDictionaries();

  it.each(COMPLETE_LOCALES)("%s defines every English key", (locale) => {
    const dict = overrides[locale] ?? {};
    const missing = Object.keys(en).filter((key) => typeof dict[key] !== "string" || dict[key]!.trim() === "");
    expect(missing).toEqual([]);
  });

  it.each(Object.keys(overrides))("%s keeps placeholders and HTML tags of the English source", (locale) => {
    const broken = Object.entries(overrides[locale] ?? {})
      .filter(([key]) => key in en)
      .filter(([key, value]) => placeholderNames(value) !== placeholderNames(en[key]!) || htmlTags(value) !== htmlTags(en[key]!))
      .map(([key]) => key);
    expect(broken).toEqual([]);
  });

  it.each(Object.keys(overrides))("%s has no unknown keys", (locale) => {
    const unknown = Object.keys(overrides[locale] ?? {}).filter((key) => !(key in en));
    expect(unknown).toEqual([]);
  });

  it("ships the same manifest message keys in every _locales folder", () => {
    const localesDir = join(clipperDir, "_locales");
    const read = (folder: string) =>
      JSON.parse(readFileSync(join(localesDir, folder, "messages.json"), "utf8")) as Record<string, { message: string }>;
    const reference = Object.keys(read("en")).sort();
    for (const folder of readdirSync(localesDir)) {
      const messages = read(folder);
      expect(Object.keys(messages).sort(), folder).toEqual(reference);
      for (const key of reference) expect(messages[key]!.message.trim(), `${folder}.${key}`).not.toBe("");
    }
  });
});
