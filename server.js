import express from "express";
import axios from "axios";
import cors from "cors";
import https from "https";

const app = express();

app.use(cors());

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const URL_FFHB =
  "https://www.ffhandball.fr/competitions/saison-2026-2027-22/departemental/u13f-44-32272/poule-190214/";

app.get("/planning", async (req, res) => {
  try {
    const response = await axios.get(
      URL_FFHB,
      {
        httpsAgent,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
        },
      }
    );

    res.send(response.data);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.listen(3000, () => {
  console.log(
    "API SNHB démarrée sur le port 3000"
  );
});