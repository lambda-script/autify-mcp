// openapi-typescript is driven by the `generate` npm script:
//   openapi-typescript openapi/swagger.yml -o src/generated/autify.d.ts
// This file documents the intent and pins options if we later switch to the JS API.
export default {
  input: "openapi/swagger.yml",
  output: "src/generated/autify.d.ts",
};
