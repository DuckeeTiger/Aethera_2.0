const translations = require("./translations.js");
const spells = require("./spells.js");

function userMarkdownSetup(md) {
}

function userEleventySetup(eleventyConfig) {

  eleventyConfig.on("eleventy.after", () => {

    translations.buildTranslationRegistry();
    spells.buildSpellIndex();

  });

  eleventyConfig.addGlobalData("dynamics.common.head", [
    "custom/leaflet/head.njk"
  ]);

  eleventyConfig.addGlobalData("dynamics.common.afterContent", [
  "custom/spellIndex.njk"
  ]);

}

exports.userMarkdownSetup = userMarkdownSetup;
exports.userEleventySetup = userEleventySetup;