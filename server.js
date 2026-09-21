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
  
const lignesDeroulement =
  texteComplet.split("\n");
  
const statsButs =
  new Map();  
  
  for (
  const ligne of lignesDeroulement
) {

  if (
    ligne.includes("But")
  ) {

    console.log(
      "BUT >>>",
      ligne
    );

  }

}
  
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

  let nbButs = 0;
  let nb7m = 0;

  const chiffres =
    apresLicence.match(/\d+/g) || [];

  if (chiffres.length >= 3) {

    nbButs =
      Number(chiffres[0]);

    nb7m =
      Number(chiffres[1]);

  }
  else if (
    chiffres.length >= 2
  ) {

    nbButs =
      Number(chiffres[0]);

  }

  joueuses.push({

    nom:
      `${nom.trim()} ${prenom.trim()}`,

    matchs: 1,

    buts: nbButs,

    septMetres: nb7m

  });

}
console.log(
  "NB JOUEUSES",
  fdmCode,
  joueuses.length
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