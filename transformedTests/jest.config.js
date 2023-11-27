/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  transformIgnorePatterns: ['.*'], // Don't let jest transform stuff. We already have our own (better) build system !
  testPathIgnorePatterns: [".*\.ts$",".*dist/.*$"], // Don't let jest try to execute .ts files (it fails cause you can't load MODULES at runtime). One can only the compiled commonjs .js files :(
  globals: {
    'ts-jest': {
      compiler: 'ts-patch'
    }
  }
};
