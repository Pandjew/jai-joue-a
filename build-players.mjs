/**
 * build-players.mjs — génère une base de joueurs depuis Wikidata
 * ----------------------------------------------------------------
 * USAGE (Node 18+, fetch intégré) :
 *   node build-players.mjs > players.json
 * puis dans l'app : importer players.json à la place du tableau PLAYERS.
 *
 * MÉTHODE :
 *  1) on part de "clubs graines" (grands clubs, par championnat) ;
 *  2) on récupère les joueurs notables passés par ces clubs, actifs depuis 2000 ;
 *  3) pour chaque joueur on lit TOUTE sa carrière en club via la propriété
 *     P54 (membre d'une équipe) + qualificatifs P580/P582 (dates),
 *     P1350 (matchs), P1351 (buts).
 *
 * LIMITES (déjà discutées) : les matchs/buts (P1350/P1351) sont souvent
 * absents sur Wikidata -> ils sortent en `null` et il faudra les compléter
 * ou afficher "—". Les clubs + années sont eux bien couverts.
 * Données Wikidata = CC0 (libres). Les logos (P154) sont un autre sujet (droits).
 */

const ENDPOINT = "https://query.wikidata.org/sparql";
const API = "https://www.wikidata.org/w/api.php";
const UA = "JaiJoueA/1.0 (https://jai-joue-a.vercel.app; projet perso)";
const MIN_SITELINKS = 30;   // filtre de notoriété (monte-le pour réduire la base, ex. 40 = stars)
const BATCH = 20;           // joueurs par requête de carrière (plus petit = moins de timeouts)

// 1) Clubs graines — ajoute/retire à volonté (accent L1 / PL / Liga)
//    `qid` optionnel : si présent, on évite l'appel de recherche.
const SEED_CLUBS = [
  { name: "Paris Saint-Germain", league: "l1", qid: "Q483020" },
  { name: "Olympique de Marseille", league: "l1", qid: "Q132885" },
  { name: "Olympique Lyonnais", league: "l1", qid: "Q704" },
  { name: "AS Monaco", league: "l1", qid: "Q180305" },
  { name: "Lille OSC", league: "l1", qid: "Q19516" },
  { name: "Manchester United", league: "pl", qid: "Q18656" },
  { name: "Manchester City", league: "pl", qid: "Q50602" },
  { name: "Liverpool F.C.", league: "pl", qid: "Q1130849" },
  { name: "Chelsea F.C.", league: "pl", qid: "Q9616" },
  { name: "Arsenal F.C.", league: "pl", qid: "Q9617" },
  { name: "Tottenham Hotspur", league: "pl" },
  { name: "Real Madrid", league: "lg" },
  { name: "FC Barcelona", league: "lg" },
  { name: "Atlético Madrid", league: "lg" },
  { name: "Sevilla FC", league: "lg" },
  { name: "Valencia CF", league: "lg" },
  { name: "Juventus FC", league: "sa" },
  { name: "AC Milan", league: "sa" },
  { name: "Inter Milan", league: "sa" },
  { name: "AS Roma", league: "sa" },
  { name: "Bayern Munich", league: "bl" },
  { name: "Borussia Dortmund", league: "bl" },
];

const Q_CLUB = "Q476028";      // club de football
const Q_PLAYER = "Q937857";    // footballeur
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const qid = (uri) => uri.split("/").pop();

// Récupère du JSON avec réessais + lecture défensive (gère les pages d'erreur/limite de débit)
async function fetchJSON(url, label = "") {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      try {
        return JSON.parse(text);
      } catch {
        throw new Error("réponse non-JSON : " + text.slice(0, 80).replace(/\s+/g, " "));
      }
    } catch (e) {
      if (attempt === 4) throw e;
      const wait = attempt * 1500;
      console.error(`  ⚠ ${label} : ${e.message} — réessai ${attempt}/3 dans ${wait}ms`);
      await sleep(wait);
    }
  }
}

async function sparql(query) {
  const url = ENDPOINT + "?format=json&query=" + encodeURIComponent(query);
  return (await fetchJSON(url, "SPARQL")).results.bindings;
}

// Résout un nom de club -> QID (1er résultat décrit comme club de foot)
async function resolveClub(name) {
  const url = `${API}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&format=json&limit=5`;
  const data = await fetchJSON(url, "recherche " + name);
  const hit = (data.search || []).find((s) => /football club|soccer/i.test(s.description || "")) || (data.search || [])[0];
  return hit ? hit.id : null;
}

async function main() {
  // --- Résolution des clubs graines ---
  const clubLeague = {}; // QID -> league
  const seedQids = [];
  for (const c of SEED_CLUBS) {
    const id = c.qid || (await resolveClub(c.name));
    if (id) { clubLeague[id] = c.league; seedQids.push(id); console.error(`✓ ${c.name} -> ${id}`); }
    else console.error(`✗ club introuvable : ${c.name}`);
    if (!c.qid) await sleep(400); // pause uniquement quand on a appelé l'API
  }
  const seedValues = seedQids.map((q) => "wd:" + q).join(" ");

  // --- Joueurs candidats (passés par un club graine, notables, actifs 2000+) ---
  const candQuery = `
    SELECT DISTINCT ?player ?links WHERE {
      VALUES ?club { ${seedValues} }
      ?player wdt:P106 wd:${Q_PLAYER} ;
              wikibase:sitelinks ?links ;
              p:P54 ?st .
      ?st ps:P54 ?club .
      OPTIONAL { ?st pq:P582 ?end . }
      FILTER( !BOUND(?end) || YEAR(?end) >= 2000 )
      FILTER( ?links >= ${MIN_SITELINKS} )
    }`;
  const cand = await sparql(candQuery);
  const popByQid = {};
  for (const r of cand) popByQid[qid(r.player.value)] = +r.links.value;
  const playerQids = Object.keys(popByQid);
  console.error(`→ ${playerQids.length} joueurs candidats`);

  // --- Carrières (par lots) ---
  const players = {};
  for (let i = 0; i < playerQids.length; i += BATCH) {
    const slice = playerQids.slice(i, i + BATCH);
    const values = slice.map((q) => "wd:" + q).join(" ");
    const q = `
      SELECT ?player ?playerLabel ?club ?clubLabel ?start ?end ?apps ?goals WHERE {
        VALUES ?player { ${values} }
        ?player p:P54 ?st .
        ?st ps:P54 ?club .
        ?club wdt:P31 wd:${Q_CLUB} .
        OPTIONAL { ?st pq:P580 ?start . }
        OPTIONAL { ?st pq:P582 ?end . }
        OPTIONAL { ?st pq:P1350 ?apps . }
        OPTIONAL { ?st pq:P1351 ?goals . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
      }`;
    let rows;
    try {
      rows = await sparql(q);
    } catch (e) {
      console.error(`  ✗ lot ${Math.floor(i / BATCH) + 1} ignoré (${e.message})`);
      await sleep(800);
      continue;
    }
    for (const r of rows) {
      const pid = qid(r.player.value);
      const name = r.playerLabel?.value;
      if (!name || /^Q\d+$/.test(name)) continue;
      players[pid] ||= { name, pop: popByQid[pid] || 0, leaguesSet: new Set(), career: [] };
      const sy = r.start ? +r.start.value.slice(0, 4) : null;
      const ey = r.end ? +r.end.value.slice(0, 4) : null;
      players[pid].career.push({
        club: r.clubLabel?.value || "?",
        clubQ: qid(r.club.value),
        sy, ey,
        apps: r.apps ? +r.apps.value : null,
        goals: r.goals ? +r.goals.value : null,
      });
      const lg = clubLeague[qid(r.club.value)];
      if (lg) players[pid].leaguesSet.add(lg);
    }
    console.error(`  carrières ${i + slice.length}/${playerQids.length}`);
    await sleep(800);
  }

  // --- Mise en forme finale (format de l'app) ---
  const out = Object.values(players)
    .map((p) => {
      const career = p.career
        .filter((c, idx, arr) => arr.findIndex((x) => x.clubQ === c.clubQ && x.sy === c.sy) === idx) // dédoublonne
        .sort((a, b) => (a.sy || 9999) - (b.sy || 9999))
        .map((c) => ({
          club: c.club,
          years: c.sy ? `${c.sy}–${c.ey ?? ""}` : "",
          apps: c.apps,    // null si inconnu
          goals: c.goals,  // null si inconnu
        }));
      return { name: p.name, pop: p.pop, leagues: [...p.leaguesSet], career };
    })
    .filter((p) => p.career.length >= 2 && p.leagues.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  process.stdout.write(JSON.stringify(out, null, 2));
  console.error(`\n✓ ${out.length} joueurs écrits.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
