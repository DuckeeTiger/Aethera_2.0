const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const NOTES_ROOT = path.resolve(process.cwd(), "src/site/notes");
const OUTPUT_DIR = path.resolve(process.cwd(), "dist/assets");
function slugifyPathPart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function notePathToUrl(filePath) {
  const relative = path.relative(NOTES_ROOT, filePath);
  const parts = relative.split(path.sep);

  const withoutExt = parts.join("/").replace(/\.md$/i, "");
  const urlParts = withoutExt.split("/").map(slugifyPathPart);

  return "/" + urlParts.join("/") + "/";
}

function splitSpellClasses(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSpellLevel(value) {
  if (value === 0 || value === "0") return 0;

  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

function walkMarkdownFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkMarkdownFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function getSpellFromFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const data = parsed.data || {};
  const props = data["dg-note-properties"] || {};

  if (
    !props.spell_name ||
    props.spell_level === undefined ||
    !props.spell_school ||
    !props.spell_classes ||
    !props.spell_source ||
    !props.tr_lang ||
    !props.tr_id
  ) {
    return null;
  }

  return {
    name: props.spell_name,
    level: normalizeSpellLevel(props.spell_level),
    school: props.spell_school,
    classes: splitSpellClasses(props.spell_classes),
    source: props.spell_source,
    lang: props.tr_lang,
    trId: props.tr_id,
    translation: props.translation || "",
    url: data.permalink || notePathToUrl(filePath),
  };
}

function buildSpellIndex() {


  const files = walkMarkdownFiles(NOTES_ROOT);

  const spells = files
    .map(getSpellFromFile)
    .filter(Boolean)
    .sort((a, b) => {
      if (a.level !== b.level) return Number(a.level) - Number(b.level);
      return a.name.localeCompare(b.name, "hu");
    });

  const byLang = {
    en: spells.filter((spell) => spell.lang === "en"),
    hu: spells.filter((spell) => spell.lang === "hu"),
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "spells.en.json"),
    JSON.stringify(byLang.en, null, 2),
    "utf8"
  );

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "spells.hu.json"),
    JSON.stringify(byLang.hu, null, 2),
    "utf8"
  );

  console.log(
    `[spells] Generated spell indexes: EN ${byLang.en.length}, HU ${byLang.hu.length}`
  );
}

module.exports = {
  buildSpellIndex,
};