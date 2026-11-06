// Строки результатов для макета сайта торговли и тестов: та же разметка, что ожидают row-parser и enhancers.

const ART = "https://web.poecdn.com/image/Art/2DItems";
const DIVINE = `${ART}/Currency/CurrencyModValues.png`;
const CHAOS = `${ART}/Currency/CurrencyRerollRare.png`;
const EXALT = `${ART}/Currency/CurrencyAddModToRare.png`;

export type MockRow = {
  id: string;
  rarity: "rare" | "unique";
  name: string;
  base: string;
  icon: string;
  ilvl: number;
  sockets: number;
  mods: Array<[cls: string, text: string]>;
  corrupted?: boolean;
  price: [amount: string, currency: string, icon: string];
  seller: string;
};

export const ROWS: MockRow[] = [
  {
    id: "a1f3",
    rarity: "rare",
    name: "Doom Shell",
    base: "Vaal Regalia",
    icon: `${ART}/Armours/BodyArmours/BodyInt1C.png`,
    ilvl: 84,
    sockets: 6,
    mods: [
      ["implicitMod", "+12% to all Elemental Resistances"],
      ["explicitMod", "+105 to maximum Energy Shield"],
      ["explicitMod", "+87 to maximum Life"],
      ["explicitMod", "+38% to Fire Resistance"],
      ["craftedMod", "+15% to Cold Resistance"],
    ],
    corrupted: true,
    price: ["2.5", "Divine Orb", DIVINE],
    seller: "ExileTrader",
  },
  {
    id: "b7c2",
    rarity: "rare",
    name: "Gale Coat",
    base: "Vaal Regalia",
    icon: `${ART}/Armours/BodyArmours/BodyInt1C.png`,
    ilvl: 30,
    sockets: 3,
    mods: [
      ["explicitMod", "+64 to maximum Energy Shield"],
      ["explicitMod", "+22% to Fire Resistance"],
    ],
    price: ["40", "Chaos Orb", CHAOS],
    seller: "LeagueStarter",
  },
  {
    id: "c9d1",
    rarity: "rare",
    name: "Grim Wrap",
    base: "Savant's Robe",
    icon: `${ART}/Armours/BodyArmours/BodyInt2.png`,
    ilvl: 82,
    sockets: 5,
    mods: [["explicitMod", "+91 to maximum Energy Shield"]],
    price: ["450", "Chaos Orb", CHAOS],
    seller: "BulkSeller",
  },
  {
    id: "c9d2",
    rarity: "rare",
    name: "Grim Wrap",
    base: "Savant's Robe",
    icon: `${ART}/Armours/BodyArmours/BodyInt2.png`,
    ilvl: 82,
    sockets: 5,
    mods: [["explicitMod", "+91 to maximum Energy Shield"]],
    price: ["450", "Chaos Orb", CHAOS],
    seller: "BulkSeller",
  },
  {
    id: "c9d3",
    rarity: "rare",
    name: "Grim Wrap",
    base: "Savant's Robe",
    icon: `${ART}/Armours/BodyArmours/BodyInt2.png`,
    ilvl: 82,
    sockets: 5,
    mods: [["explicitMod", "+91 to maximum Energy Shield"]],
    price: ["450", "Chaos Orb", CHAOS],
    seller: "BulkSeller",
  },
  {
    id: "d4e8",
    rarity: "unique",
    name: "Shavronne's Wrappings",
    base: "Occultist's Vestment",
    icon: `${ART}/Armours/BodyArmours/ShavronnesWrappings.png`,
    ilvl: 75,
    sockets: 6,
    mods: [
      ["explicitMod", "+120% increased Energy Shield"],
      ["explicitMod", "Chaos Damage does not bypass Energy Shield"],
    ],
    price: ["3", "Exalted Orb", EXALT],
    seller: "UniqueHunter",
  },
];

export function rowHtml(r: MockRow): string {
  const mods = r.mods.map(([cls, text]) => `<div class="${cls}"><span class="lc s">${text}</span></div>`).join("");
  return `
  <div class="row" data-id="${r.id}">
    <div class="left">
      <div class="icon"><img src="${r.icon}" alt=""></div>
      <div class="sockets">${'<div class="socket"></div>'.repeat(r.sockets)}</div>
    </div>
    <div class="middle">
      <div class="itemRendered">
        <div class="itemPopupContainer newItemPopup ${r.rarity}Popup">
          <div class="itemHeader doubleLine">
            <div class="itemName"><span class="lc">${r.name}</span></div>
            <div class="itemName typeLine"><span class="lc">${r.base}</span></div>
          </div>
          <div class="content">
            <div class="property"><span class="lc">Quality: +20%</span></div>
            <div class="itemLevel"><span class="lc">Item Level: ${r.ilvl}</span></div>
            ${mods}
            ${r.corrupted ? '<div class="unmet"><span class="lc">Corrupted</span></div>' : ""}
          </div>
        </div>
      </div>
    </div>
    <div class="right">
      <div class="details">
        <div class="price"><span data-field="price"><span>~price</span><br><span>${r.price[0]}</span>×<span class="currency-image"><img src="${r.price[2]}" alt="${r.price[1]}"></span><span class="currency-text"><span>${r.price[1]}</span></span></span></div>
        <div class="profile-link"><a href="/account/view-profile/${r.seller}">${r.seller}</a></div>
        <div class="character-name">IGN: ${r.seller}_char</div>
        <div class="btns">
          <span><button class="btn btn-default">Whisper</button></span>
          <a class="pm-btn" href="/private-messages/compose?to=${r.seller}" hidden></a>
        </div>
      </div>
    </div>
  </div>`;
}
