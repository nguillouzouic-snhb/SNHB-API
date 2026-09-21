let debugAffiche = false;
import express from "express";
import axios from "axios";
import cors from "cors";
import * as pdfParse from "pdf-parse";

const cache = new Map();
const app = express();

app.use(cors());

app.get("/planning/:equipe", async (req, res) => {

  const cacheKey =
    `planning_${req.params.equipe}`;

  const cached =
    getCache(cacheKey);

  if (cached) {

    return res.json(cached);

  }

  try {

    const collectif =
      COLLECTIFS[req.params.equipe];

    if (!collectif) {

      return res.status(404).json({
        erreur: "Collectif inconnu"
      });

    }

    const baseUrl =
      buildBaseUrl(collectif);

    const response =
      await axios.get(
        `${baseUrl}/`
      );

    const html =
      decodeHtml(response.data);

    const journees =
      extractJournees(html);

    let toutesLesRencontres = [];

    for (const j of journees) {

      const url =
        `${baseUrl}/journee-${j.numero}/`;

      try {

        const page =
          await axios.get(url);

        const htmlJournee =
          decodeHtml(page.data);

        const rencontres =
          extractRencontres(
            htmlJournee
          );

        toutesLesRencontres.push(
          ...rencontres
        );

      } catch (err) {

        console.error(
          `Erreur J${j.numero}`,
          err.message
        );

      }

    }

    const map = new Map();

    toutesLesRencontres.forEach(r => {

      map.set(
        r.fdmCode,
        r
      );

    });

    const rencontresUniques =
      [...map.values()];

    const resultat = {
      journees,
      rencontres:
        rencontresUniques
    };

    setCache(
      cacheKey,
      resultat,
      60
    );

    res.json(
      resultat
    );

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: error.message
    });

  }

});
    
app.get("/classement/:equipe", async (req, res) => {

  const cacheKey =
    `classement_${req.params.equipe}`;

  const cached =
    getCache(cacheKey);

  if (cached) {

    return res.json(cached);

  }

  try {

    const collectif =
      COLLECTIFS[req.params.equipe];

    if (!collectif) {

      return res.status(404).json({
        erreur: "Collectif inconnu"
      });

    }

    const BASE_URL =
      buildBaseUrl(collectif);

    const response =
      await axios.get(
        `${BASE_URL}/classements/`
      );

    const html =
      decodeHtml(response.data);

    const classement =
      extractClassement(html);

    setCache(
      cacheKey,
      classement,
      60
    );

    res.json(
      classement
    );

  } catch (error) {

    res.status(500).json({
      erreur: error.message
    });

  }

});

app.get(  "/test-pdf/:equipe/:fdmCode",
  async (req, res) => {

    const cacheKey =
      `testpdf_${req.params.fdmCode}`;

    const cached =
      getCache(cacheKey);

    if (cached) {

      return res.json({
        joueuses: cached
      });

    }

    try {

      const collectif =
        COLLECTIFS[
          req.params.equipe
        ];

      if (!collectif) {

        return res.status(404).json({
          erreur: "Collectif inconnu"
        });

      }

      const joueuses =
        await getStatsMatch(
          req.params.fdmCode,
          collectif.club
        );

      setCache(
        cacheKey,
        joueuses,
        1440
      );

      res.json({
        joueuses
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        erreur: err.message
      });

    }

  }
);

app.get(  "/joueuses/:equipe",
  async (req, res) => {

    const cacheKey =
      `joueuses_${req.params.equipe}`;

    const cached =
      getCache(cacheKey);

    if (cached) {

      return res.json(cached);

    }

    try {

      const collectif =
        COLLECTIFS[
          req.params.equipe
        ];

      const baseUrl =
        buildBaseUrl(collectif);

      const response =
        await axios.get(
          `${baseUrl}/`
        );

      const html =
        decodeHtml(
          response.data
        );

      const journees =
        extractJournees(
          html
        );

      let rencontres = [];

      for (const j of journees) {

        const page =
          await axios.get(
            `${baseUrl}/journee-${j.numero}/`
          );

        const htmlJournee =
          decodeHtml(
            page.data
          );

        rencontres.push(
          ...extractRencontres(
            htmlJournee
          )
        );

      }

      const matchsEquipe =
        rencontres.filter(
          r =>
            r.domicile === collectif.club ||
            r.exterieur === collectif.club
        );

      const matchsJoues =
        matchsEquipe.filter(
          r =>
            r.fdmCode &&
            r.scoreDomicile !== null &&
            r.scoreExterieur !== null
        );

      const joueusesMap =
        new Map();

      for (const match of matchsJoues) {

        try {

          const statsMatch =
            await getStatsMatch(
              match.fdmCode,
              collectif.club
            );

          for (const j of statsMatch) {

            const cle =
              j.nom
                .trim()
                .toUpperCase();

            if (
              !joueusesMap.has(cle)
            ) {

              joueusesMap.set(
                cle,
                {
                  nom: j.nom,
                  matchs: 0,
                  buts: 0,
                  septMetres: 0
                }
              );

            }

            const joueuse =
              joueusesMap.get(cle);

            joueuse.matchs +=
              j.matchs;

            joueuse.buts +=
              j.buts;

            joueuse.septMetres +=
              j.septMetres;

          }

        } catch (err) {

          console.error(
            "Erreur FDM",
            match.fdmCode,
            err.message
          );

        }

      }

      const resultat =
        [...joueusesMap.values()]
          .sort((a, b) => {

            if (b.buts !== a.buts) {
              return b.buts - a.buts;
            }

            return a.nom.localeCompare(
              b.nom
            );

          });

      setCache(
        cacheKey,
        resultat,
        60
      );

      res.json(
        resultat
      );

    } catch (err) {

      res.status(500).json({
        erreur: err.message
      });

    }

  }
);

function buildBaseUrl(collectif) {

  return `https://www.ffhandball.fr/competitions/saison-2026-2027-22/departemental/${collectif.competition}/poule-${collectif.poule}`;

}

function extractClassement(html) {
  try {

    const match = html.match(
      /"classements":(\[[\s\S]*?\])/
    );

    if (!match) {
      return [];
    }

    const classements =
      JSON.parse(match[1]);

    return classements.map(c => ({
      rang: Number(c.place),
      equipe: c.equipe_libelle,
      points: Number(c.point)
    }));

  } catch (err) {

    console.error(
      "Erreur extraction classement",
      err
    );

    return [];
  }
}

function decodeHtml(html) {

  return html
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&#039;", "'");
}

function extractJournees(html) {
  try {

    const match = html.match(
      /"journees":"(\[[\s\S]*?\])"/
    );

    if (!match) {
      return [];
    }

    let journeesJson =
      match[1];

    journeesJson =
      journeesJson
        .replace(/\\\\/g, "\\")
        .replace(/\\"/g, '"');

    const journees =
      JSON.parse(
        journeesJson
      );

    return journees.map(j => ({
      numero: Number(
        j.journee_numero
      ),
      debut:
        j.date_debut,
      fin:
        j.date_fin
    }));

  } catch (err) {

    console.error(
      "Erreur extraction journées",
      err
    );

    return [];
  }
}

function extractRencontres(html) {
  try {

    const match = html.match(
      /"rencontres":(\[[\s\S]*?\])\}/
    );

    if (!match) {
      return [];
    }

    const rencontres =
      JSON.parse(match[1]);

    // DEBUG FFHB
    if (
  !debugAffiche &&
  rencontres.length > 0
) {

  debugAffiche = true;

}

    return rencontres.map(r => ({
      journee: Number(
        r.journeeNumero
      ),

      domicile:
        r.equipe1Libelle,

      exterieur:
        r.equipe2Libelle,

      date:
        r.date,

      fdmCode:
        r.fdmCode,

      scoreDomicile:
        r.equipe1Score,

      scoreExterieur:
        r.equipe2Score
    }));

  } catch (err) {

    console.error(
      "Erreur extraction rencontres",
      err
    );

    return [];
  }
}

async function getStatsMatch(
  fdmCode,
  clubRecherche
) {

  const cacheKey =
    `fdm_${fdmCode}`;

  const cached =
    getCache(cacheKey);

  if (cached) {

    return cached;

  }

  const url =
    `https://fdm.fdme.ffhandball.fr/${fdmCode[0]}/${fdmCode[1]}/${fdmCode[2]}/${fdmCode[3]}/${fdmCode}.pdf`;

  const response =
    await axios.get(url, {
      responseType: "arraybuffer"
    });

const parser =
  new pdfParse.PDFParse({
    data: response.data
  });

await parser.load();

const texte =
  await parser.getText();

const texteComplet =
  texte.text;
  
const statsButs =
  new Map();

const lignesDeroulement =
  texteComplet.split("\n");

for (const ligne of lignesDeroulement) {

  const matchBut =
    ligne.match(
      /But(?:\s+7m)?\s+([A-Z\-]+)\s+(.+)$/
    );

  if (!matchBut) {
    continue;
  }

  const nomJoueuse =
    `${matchBut[1]} ${matchBut[2]}`
      .trim();

  if (!statsButs.has(
    nomJoueuse
  )) {

    statsButs.set(
      nomJoueuse,
      {
        buts: 0,
        septMetres: 0
      }
    );

  }

  const stats =
    statsButs.get(
      nomJoueuse
    );

  stats.buts++;

  if (
    ligne.includes(
      "But 7m"
    )
  ) {

    stats.septMetres++;

  }

}
``
  
const indexClub =
  texteComplet.indexOf(
    "\n" + clubRecherche + "\n"
  );


if (indexClub === -1) {

  return [];

}

const texteApresClub =
  texteComplet.substring(
    indexClub
  );

const indexOfficiel =
  texteApresClub.indexOf(
    "Officiel Resp. A"
  );

if (indexOfficiel === -1) {

  console.error(
    "Fin du bloc introuvable"
  );

  return [];

}

const blocClub =
  texteApresClub.substring(
    0,
    indexOfficiel
  );

const debutClub =
  blocClub.indexOf(
    clubRecherche
  );

const zoneJoueuses =
  blocClub.substring(
    debutClub
  );

const lignes =
  zoneJoueuses.split("\n");

  const joueuses = [];

for (const ligne of lignes) {

  const licenceMatch =
    ligne.match(/\d{13}/);

  if (!licenceMatch) {
    continue;
  }

  const licence =
    licenceMatch[0];

  const avantLicence =
    ligne.substring(
      0,
      ligne.indexOf(licence)
    );

  const apresLicence =
    ligne.substring(
      ligne.indexOf(licence) +
      licence.length
    );

  const morceaux =
    avantLicence
      .replace(/^X\s+/, "")
      .trim()
      .split(/\s+/);

  if (morceaux.length < 3) {
    continue;
  }

  const numero =
    morceaux[0];

  const nom =
    morceaux[1];

  const prenom =
    morceaux.slice(2).join(" ");

const nomComplet =
  `${nom.trim()} ${prenom.trim()}`;

const stats =
  statsButs.get(
    nomComplet
  ) || {
    buts: 0,
    septMetres: 0
  };

joueuses.push({

  nom: nomComplet,

  matchs: 1,

  buts:
    stats.buts,

  septMetres:
    stats.septMetres

});

}

setCache(
  cacheKey,
  joueuses,
  1440
);
  return joueuses;

}

function getCache(key) {

  const item =
    cache.get(key);

  if (!item) {
    return null;
  }

  if (
    Date.now() >
    item.expiration
  ) {

    cache.delete(key);

    return null;
  }

  return item.data;

}

function setCache(
  key,
  data,
  minutes = 60
) {

  cache.set(
    key,
    {
      data,
      expiration:
        Date.now() +
        minutes *
          60 *
          1000
    }
  );

}

async function warmupCache() {

  console.log(
    "Préchargement du cache..."
  );

  const equipes = [
    "U13F1",
    "U13F2",
    "U11F"
  ];

  for (const equipe of equipes) {

    try {

      await chargerPlanning(
        equipe
      );

      await chargerClassement(
        equipe
      );

      await chargerJoueuses(
        equipe
      );

      console.log(
        `Cache OK ${equipe}`
      );

    } catch (err) {

      console.error(
        `Erreur warmup ${equipe}`,
        err.message
      );

    }

  }

}

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, async () => {

  console.log(
    `API SNHB démarrée sur le port ${PORT}`
  );

  await warmupCache();

});

setInterval(
  async () => {

    console.log(
      "Refresh cache..."
    );

    await warmupCache();

  },
  60 * 60 * 1000
);

const COLLECTIFS = {

  U13F2: {
    competition: "u13f-44-32272",
    poule: "190214",
    club: "ST NAZAIRE HANDBALL 2"
  },

  U13F1: {
    competition: "u13f-44-32272",
    poule: "190212",
    club: "ST NAZAIRE HANDBALL 1"
  },

  U11F: {
    competition: "u11f-44-32883",
    poule: "195004",
    club: "ST NAZAIRE HANDBALL"
  }

};