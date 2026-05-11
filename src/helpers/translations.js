

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

        const props = parsed.data["dg-note-properties"];

        if (!props) continue;

        const trId = props.tr_id;
        const trLang = props.tr_lang;

        const permalink = parsed.data.permalink;

        if (!trId || !trLang || !permalink) {
          continue;
        }

        if (!registry[trId]) {
          registry[trId] = {};
        }

        registry[trId][trLang] = permalink;

      } catch (err) {

        console.error("[Translations] Failed:", fullPath);
      }
    }
  }

  scanDirectory(notesPath);

  fs.writeFileSync(
    outputPath,
    JSON.stringify(registry, null, 2),
    "utf8"
  );

  console.log("[Translations] Registry generated");
}

module.exports = {
  buildTranslationRegistry,
};

