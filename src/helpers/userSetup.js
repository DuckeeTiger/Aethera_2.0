const translations = require("./translations.js");

console.log(translations);

function userMarkdownSetup(md) {
}

function userEleventySetup(eleventyConfig) {

  eleventyConfig.on("beforeBuild", () => {

    translations.buildTranslationRegistry();

  });

}

exports.userMarkdownSetup = userMarkdownSetup;
exports.userEleventySetup = userEleventySetup;