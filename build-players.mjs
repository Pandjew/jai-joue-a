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

const Q_CLUB = "Q476028";        // club de football
const Q_SPORTS_CLUB = "Q847017"; // club omnisports (ex. FC Barcelone)
const Q_PLAYER = "Q937857";      // footballeur
const Q_MALE = "Q6581097";       // sexe masculin
const CLUB_MIN_LINKS = 6;        // en dessous : club jugé non pro (retiré en début de carrière)
const MIN_CAREER_APPS = 100;     // carrière finie : on écarte sous ce total de matchs
const SAFE_POP = 50;             // au-dessus : joueur très connu, jamais écarté par la règle des matchs
const RESERVE_RE = /(\sB|\sC|\sII|\sIII)$|castilla|réserve|reserves?\b/i; // équipes réserves
const NATIONAL_RE = /national.*football team|équipe d['e].+ de football|\bsélection\b/i; // sélections nationales
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
              wdt:P21 wd:${Q_MALE} ;
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
      SELECT ?player ?playerLabel ?club ?clubLabel ?start ?end ?apps ?goals ?acqLabel ?clinks ?ispart WHERE {
        VALUES ?player { ${values} }
        ?player p:P54 ?st .
        ?st ps:P54 ?club .
        ?club wikibase:sitelinks ?clinks .
        BIND(EXISTS { ?club wdt:P361 [] } AS ?ispart)
        OPTIONAL { ?st pq:P580 ?start . }
        OPTIONAL { ?st pq:P582 ?end . }
        OPTIONAL { ?st pq:P1350 ?apps . }
        OPTIONAL { ?st pq:P1351 ?goals . }
        OPTIONAL { ?st pq:P1642 ?acq . }
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
        loan: r.acqLabel ? /loan|pr[êe]t/i.test(r.acqLabel.value) : false,
        clinks: r.clinks ? +r.clinks.value : 0,
        ispart: r.ispart?.value === "true",
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
      let career = p.career.slice();

      // 0) retire réserves/sections (équipe rattachée à un club parent ET peu notable) et sélections nationales
      career = career.filter((c) =>
        !NATIONAL_RE.test(c.club) &&
        !RESERVE_RE.test(c.club) &&
        !(c.ispart && (c.clinks || 0) < 30)
      );

      // 1) retire les entrées sans date quand le même club a une entrée datée (doublons fantômes, ex. Harry Kane)
      const datedClubs = new Set(career.filter((c) => c.sy != null).map((c) => c.clubQ));
      career = career.filter((c) => c.sy != null || !datedClubs.has(c.clubQ));

      // 2) dédoublonne (même club, même année de début)
      career = career.filter((c, idx, arr) => arr.findIndex((x) => x.clubQ === c.clubQ && x.sy === c.sy) === idx);

      // 3) tri chronologique
      career.sort((a, b) => (a.sy || 9999) - (b.sy || 9999));

      // 4) retire les tout premiers clubs non pros (peu notables) en tête de carrière
      const firstPro = career.findIndex((c) => (c.clinks || 0) >= CLUB_MIN_LINKS);
      if (firstPro > 0) career = career.slice(firstPro);

      // 5) carrière en cours ? + total de matchs connus
      const active = career.some((c) => c.sy != null && c.ey == null);
      const totalApps = career.reduce((s, c) => s + (c.apps || 0), 0);

      const display = career.map((c) => ({
        club: c.club,
        years: c.sy ? `${c.sy}–${c.ey ?? ""}` : "",
        apps: c.apps,
        goals: c.goals,
        ...(c.loan ? { loan: true } : {}),
      }));

      return { name: p.name, pop: p.pop, leagues: [...p.leaguesSet], career: display, _active: active, _apps: totalApps };
    })
    .filter((p) => {
      if (p.career.length < 2 || p.leagues.length === 0) return false;
      // carrière finie, total de matchs connu mais < 100, et pas une vedette -> écarté
      if (!p._active && p._apps > 0 && p._apps < MIN_CAREER_APPS && p.pop < SAFE_POP) return false;
      return true;
    })
    .map(({ _active, _apps, ...p }) => p) // retire les champs internes
    .sort((a, b) => a.name.localeCompare(b.name));

  process.stdout.write(JSON.stringify(out, null, 2));
  console.error(`\n✓ ${out.length} joueurs écrits.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
