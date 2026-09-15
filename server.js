import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();

app.use(cors());

const URL_FFHB =
  "https://www.ffhandball.fr/competitions/saison-2026-2027-22/departemental/u13f-44-32272/poule-190214/";

app.get("/planning", async (req, res) => {
  try {
    const response = await axios.get(URL_FFHB);

    const html = response.data;

    const pos1 = html.indexOf("selected_poule");
    const pos2 = html.indexOf("rencontres");

    res.json({
      selectedPoule: html.substring(
        Math.max(0, pos1 - 300),
        pos1 + 2000
      ),
      rencontres: html.substring(
        Math.max(0, pos2 - 300),
        pos2 + 2000
      )
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

function extractJournees(html) {
  try {

    const match = html.match(
      /"selected_poule":\{[\s\S]*?"journees":"([^"]+)"/
    );

    if (!match) {
      return [];
    }

    const journeesString =
      match[1]
        .replace(/\\"/g, '"');

    const journees =
      JSON.parse(journeesString);

    return journees.map(j => ({
      numero: Number(
        j.journee_numero
      ),
      debut: j.date_debut,
      fin: j.date_fin
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