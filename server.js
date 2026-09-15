import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();

app.use(cors());

const BASE_URL =
  "https://www.ffhandball.fr/competitions/saison-2026-2027-22/departemental/u13f-44-32272/poule-190214";

app.get("/planning", async (req, res) => {
  try {

    // J1 (page principale)
    const response =
      await axios.get(`${BASE_URL}/`);

    const html =
      decodeHtml(response.data);

    const journees =
      extractJournees(html);

    let toutesLesRencontres = [];

    for (const j of journees) {

      const url =
        j.numero === 1
          ? `${BASE_URL}/`
          : `${BASE_URL}/journee-${j.numero}/`;

      console.log(
        `Chargement ${url}`
      );

      try {

        const page =
          await axios.get(url);

        const htmlJournee =
          decodeHtml(page.data);

        const rencontres =
          extractRencontres(
            htmlJournee
          );

        console.log(
          `J${j.numero} : ${rencontres.length} rencontre(s)`
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

    // Suppression des doublons
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
app.get("/debug-classement", async (req, res) => {
  try {

    const response = await axios.get(
      `${BASE_URL}/classements/`
    );

    const html = decodeHtml(
      response.data
    );

    const pos =
      html.indexOf(
        "ST NAZAIRE HANDBALL"
      );

    res.type("text/plain");

    res.send(
      html.substring(
        Math.max(0, pos - 2000),
        pos + 10000
      )
    );

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }
});
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
      JSON.parse(
        match[1]
      );

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
        r.fdmCode
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
