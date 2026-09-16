let debugAffiche = false;
import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();

app.use(cors());

app.get("/planning/:equipe", async (req, res) => {

  console.log(
    "APPEL PLANNING",
    req.params.equipe
  );

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
  `${BASE_URL}/journee-${j.numero}/`;

      try {

        const page =
          await axios.get(url);

        const htmlJournee =
  decodeHtml(page.data);

if (j.numero === 1) {

  console.log(
    "CONTIENT RENCONTRES ?",
    htmlJournee.includes('"rencontres":')
  );

  console.log(
    "TAILLE HTML J1",
    htmlJournee.length
  );

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

  console.log(
    "FFHB BRUT ==================="
  );

  console.log(
    JSON.stringify(
      rencontres[0],
      null,
      2
    )
  );

  console.log(
    "============================="
  );

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
  }
};