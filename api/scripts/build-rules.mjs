import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(packageRoot, "src", "rules.generated.json");

// The Rules repo's CI assembles rules/*.yaml and publishes the result as a
// release asset on every push.
const RELEASE_URL =
  "https://github.com/Tail-WTF/Rules/releases/download/latest/sanitization_rules.yaml";

async function loadRules() {
  const override = process.env.TAIL_WTF_RULES_FILE;
  if (override) {
    return { text: readFileSync(override, "utf8"), source: override };
  }

  const sibling = join(
    packageRoot,
    "..",
    "..",
    "Link-Sanitization-Rules",
    "sanitization_rules.yaml",
  );
  if (existsSync(sibling)) {
    return { text: readFileSync(sibling, "utf8"), source: sibling };
  }

  const response = await fetch(RELEASE_URL);
  if (!response.ok) {
    throw new Error(`Fetching rules failed (${response.status}): ${RELEASE_URL}`);
  }
  return { text: await response.text(), source: RELEASE_URL };
}

const { text, source } = await loadRules();
const rules = yaml.load(text);
if (typeof rules !== "object" || rules === null) {
  throw new Error(`Expected a rule mapping from ${source}`);
}

writeFileSync(target, JSON.stringify(rules, null, 2) + "\n");
console.log(
  `Wrote rules for ${Object.keys(rules).length} domains from ${source}`,
);
