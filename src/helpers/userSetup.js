const translations = require("./translations.js");

function userMarkdownSetup(md) {
}

function userEleventySetup(eleventyConfig) {

  eleventyConfig.on("eleventy.after", () => {

    translations.buildTranslationRegistry();

  });

  eleventyConfig.addGlobalData("dynamics.common.head", [
    "custom/leaflet/head.njk"
  ]);

}

exports.userMarkdownSetup = userMarkdownSetup;
exports.userEleventySetup = userEleventySetup;