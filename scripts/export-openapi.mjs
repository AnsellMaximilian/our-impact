import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDeveloperOpenApiDocument,
  createDeveloperServerOpenApiDocument,
} from "../src/lib/developer/openapi.ts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(repositoryRoot, "apimatic/src/spec/openapi.json");
const serverOutputPath = resolve(repositoryRoot, "apimatic/server/src/spec/openapi.json");
const document = createDeveloperOpenApiDocument("https://our-impact.vercel.app");
const serverDocument = createDeveloperServerOpenApiDocument(
  "https://our-impact.vercel.app",
);

await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
await mkdir(resolve(repositoryRoot, "apimatic/server/src/spec"), { recursive: true });
await writeFile(
  serverOutputPath,
  `${JSON.stringify(serverDocument, null, 2)}\n`,
  "utf8",
);
console.log(`Exported OpenAPI document to ${outputPath}`);
console.log(`Exported server OpenAPI document to ${serverOutputPath}`);
