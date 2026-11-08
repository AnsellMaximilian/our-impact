export type AssistantEntitlementReference = {
  id: string;
  name: string;
  entitlement_key: string;
};

export type AssistantMessagePart =
  | { type: "text"; value: string }
  | { type: "entitlement"; reference: AssistantEntitlementReference };

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function assistantMessageParts(
  content: string,
  referenced: AssistantEntitlementReference[],
): AssistantMessagePart[] {
  if (!referenced.length) return [{ type: "text", value: content }];

  const cleaned = referenced.reduce(
    (message, definition) => message.replace(
      new RegExp(`\\s*\\(${escapeRegExp(definition.entitlement_key)}\\)`, "gi"),
      "",
    ),
    content,
  );
  const definitionsByToken = new Map<string, AssistantEntitlementReference>();
  for (const definition of referenced) {
    definitionsByToken.set(definition.name.toLocaleLowerCase(), definition);
    definitionsByToken.set(definition.entitlement_key.toLocaleLowerCase(), definition);
  }
  const pattern = new RegExp(
    `(${[...definitionsByToken.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|")})`,
    "gi",
  );

  return cleaned.split(pattern).filter(Boolean).map((part) => {
    const reference = definitionsByToken.get(part.toLocaleLowerCase());
    return reference
      ? { type: "entitlement" as const, reference }
      : { type: "text" as const, value: part };
  });
}
