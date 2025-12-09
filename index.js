const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bodyParser = require("body-parser");
const path = require("path")

const app = express();
const prisma = new PrismaClient();
const PORT = 3008;

const hbs = require("hbs");

// Configuration de Handlebars pour Express
app.set("view engine", "hbs"); // On définit le moteur de template que Express va utiliser
app.set("views", path.join(__dirname, "views")); // On définit le dossier des vues (dans lequel se trouvent les fichiers .hbs)
hbs.registerPartials(path.join(__dirname, "views", "partials")); // On définit le dossier des partials (composants e.g. header, footer, menu...)

app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
    // on passe seulement le nom du fichier .hbs sans l'extention.
    // Le chemin est relatif au dossier `views`.
    // On peut aller chercher des templates dans les sous-dossiers (e.g. `movies/details`).
    res.render("index"); // Page d'accueil
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});