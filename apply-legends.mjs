/**
 * apply-legends.mjs — marque `legend: true` pour les joueurs listés dans legends.txt
 * ----------------------------------------------------------------------------------
 * USAGE : node apply-legends.mjs
 *
 * legends.txt : un nom de joueur par ligne (tel qu'il apparaît dans players.json).
 * Avantage vs édition à la main : ré-exécutable après chaque regénération de la base
 * (la regénération écrase players.json et effacerait des tags posés à la main).
 */
import fs from "fs";

const PLAYERS = "src/players.json";
const LIST = "legends.txt";

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const names = fs.readFileSync(LIST, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
const wanted = new Set(names.map(norm));

const players = JSON.parse(fs.readFileSync(PLAYERS, "utf8"));
const found = new Set();
let count = 0;
for (const p of players) {
  if (wanted.has(norm(p.name))) {
    p.legend = true;
    found.add(norm(p.name));
    count++;
  } else if (p.legend) {
    delete p.legend; // retire le tag si le joueur n'est plus dans la liste
  }
}

fs.writeFileSync(PLAYERS, JSON.stringify(players, null, 2));
console.log(`✓ ${count} légendes marquées sur ${players.length} joueurs.`);

const missing = names.filter((n) => !found.has(norm(n)));
if (missing.length) console.log("⚠ noms non trouvés (vérifie l'orthographe exacte) :\n  - " + missing.join("\n  - "));
