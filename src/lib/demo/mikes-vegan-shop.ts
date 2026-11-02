export const MIKE_SHOP_PERSONAS = [
  {
    id: "jamie",
    name: "Jamie",
    description: "Neighborhood regular",
    externalUserId: "mikes_vegan_shop:jamie",
  },
  {
    id: "alex",
    name: "Alex",
    description: "Weekend shopper",
    externalUserId: "mikes_vegan_shop:alex",
  },
  {
    id: "riley",
    name: "Riley",
    description: "Community volunteer",
    externalUserId: "mikes_vegan_shop:riley",
  },
] as const;

export type MikeShopPersonaId = (typeof MIKE_SHOP_PERSONAS)[number]["id"];

export const MIKE_SHOP_PERSONA_COOKIE = "oi_mikes_vegan_shop_persona";

export function getMikeShopPersona(value: string | null | undefined) {
  return MIKE_SHOP_PERSONAS.find((persona) => persona.id === value) ?? MIKE_SHOP_PERSONAS[0];
}
