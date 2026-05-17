const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

function buildTranslationRegistry() {
  const notesPath = path.join(__dirname, "../site/notes");
  const outputPath = path.join(__dirname, "../../dist/assets/translations.json");

  const registry = {};

  function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
        continue;
      }

      if (!entry.name.endsWith(".md")) {
        continue;
      }

      try {
        const fileContent = fs.readFileSync(fullPath, "utf8");
        const parsed = matter(fileContent);
        const data = parsed.data || {};
        const props = data["dg-note-properties"] || {};

        const trId = props.tr_id || data.tr_id;
        const trLang = props.tr_lang || data.tr_lang;
        const permalink = data.permalink || data["dg-permalink"];

        if (!trId || !trLang || !permalink) {
          continue;
        }

        const normalizedLang = String(trLang).trim().toLowerCase();

        if (!registry[trId]) {
          registry[trId] = {};
        }

        registry[trId][normalizedLang] = permalink;
      } catch (err) {
        console.error("[Translations] Failed:", fullPath);
        console.error(err);
      }
    }
  }

  scanDirectory(notesPath);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  fs.writeFileSync(
    outputPath,
    JSON.stringify(registry, null, 2),
    "utf8"
  );

  console.log("[Translations] Registry generated:", outputPath);
  console.log("[Translations] Entries:", Object.keys(registry).length);
}

module.exports = {
  buildTranslationRegistry,
};