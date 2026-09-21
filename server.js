let debugAffiche = false;
import express from "express";
import axios from "axios";
import cors from "cors";
import * as pdfParse from "pdf-parse";

const app = express();

app.use(cors());

app.get("/planning/:equipe", async (req, res) => {


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

if (j.numero === 1) {


}

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

    res.json({
      journees,
      rencontres:
        rencontresUniques
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: error.message
    });

  }

});
    
app.get("/classement/:equipe", async (req, res) => {


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

    res.json(
      extractClassement(html)
    );

  } catch (error) {

    res.status(500).json({
      erreur: error.message
    });

  }

});

app.get(
  "/test-pdf/:equipe/:fdmCode",
  async (req, res) => {

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

      if (
        !joueusesMap.has(
          j.nom
        )
      ) {

        joueusesMap.set(
          j.nom,
          {
            nom: j.nom,
            matchs: 0,
            buts: 0,
            tirs: 0,
            septMetres: 0
          }
        );

      }

      const joueuse =
        joueusesMap.get(
          j.nom
        );

      joueuse.matchs +=
        j.matchs;

      joueuse.buts +=
        j.buts;

      joueuse.tirs +=
        j.tirs;

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

res.json(
  [...joueusesMap.values()]
    .sort((a, b) => {

      if (b.buts !== a.buts) {
        return b.buts - a.buts;
      }

      return a.nom.localeCompare(
        b.nom
      );

    })
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

console.log(
  "CLUB RECHERCHE =",
  clubRecherche
);

console.log(
  "CONTIENT CLUB ?",
  texteComplet.includes(
    clubRecherche
  )
);


const indexClub =
  texteComplet.indexOf(
    clubRecherche
  );

if (indexClub === -1) {

  console.error(
    "Club introuvable",
    clubRecherche
  );

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

    const match =
      ligne.match(
        /^(?:X\s+)?(\d+)\s+([A-Z\- ]+)\s+([A-Za-z\- ]+)\s+(\d{13})\s+[A-Z]+(?:\s+(\d+))?(?:\s+(\d+))?(?:\s+(\d+))?$/
      );

    if (!match) {
      continue;
    }

    const [
      ,
      numero,
      nom,
      prenom,
      licence,
      buts,
      septMetres,
      tirs
    ] = match;

    let nbButs = 0;
    let nb7m = 0;
    let nbTirs = 0;

    if (
      buts &&
      septMetres &&
      tirs
    ) {

      nbButs = Number(buts);
      nb7m = Number(septMetres);
      nbTirs = Number(tirs);

    }
    else if (
      buts &&
      septMetres
    ) {

      nbButs = Number(buts);
      nbTirs = Number(septMetres);

    }
console.log(
  "LIGNE MATCH",
  ligne
);

    joueuses.push({

      nom:
        `${nom.trim()} ${prenom.trim()}`,

      matchs: 1,

      buts: nbButs,

      septMetres: nb7m,

      tirs: nbTirs

    });

  }
  console.log(
  blocRecevant.substring(0,300)
);

console.log(
  "----------------"
);

console.log(
  blocVisiteur.substring(0,300)
);
console.log(
  "JOUEUSES MATCH",
  fdmCode
);

console.log(
  JSON.stringify(
    joueuses,
    null,
    2
  )
);

  return joueuses;

}

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `API SNHB démarrée sur le port ${PORT}`
  );
});

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