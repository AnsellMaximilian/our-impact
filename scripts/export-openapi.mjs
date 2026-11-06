import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createDeveloperOpenApiDocument } from "../src/lib/developer/openapi.ts";

const outputPath = resolve("apimatic/src/spec/openapi.json");
const document = createDeveloperOpenApiDocument("https://our-impact.vercel.app");

await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
console.log(`Exported OpenAPI document to ${outputPath}`);
