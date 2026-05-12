const translations = require("./translations.js");

console.log(translations);

function userMarkdownSetup(md) {
}

function userEleventySetup(eleventyConfig) {

  eleventyConfig.on("beforeBuild", () => {

    translations.buildTranslationRegistry();

  });

  eleventyConfig.addGlobalData("dynamics.common.head", [
    "custom/leaflet/head.njk"
  ]);

}

exports.userMarkdownSetup = userMarkdownSetup;
exports.userEleventySetup = userEleventySetup;