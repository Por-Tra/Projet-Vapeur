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

// Ajouter un jeu
app.post("/add-game", async (req, res) => {
    const { title, description, dateDeSortie, genres, editeurs, misEnAvant } = req.body;
    
    // Créer le jeu
    const jeu = await prisma.jeu.create({
        data: {
            title,
            description,
            dateDeSortie: dateDeSortie ? new Date(dateDeSortie) : new Date(),
            misEnAvant: misEnAvant === "on" || misEnAvant === "true",
        },
    });

    // Associer les genres (si fournis)
    if (genres) {
        const genreIds = Array.isArray(genres) ? genres : [genres];
        await Promise.all(
            genreIds.map((idGenre) =>
                prisma.jeuGenre.create({
                    data: {
                        idJeu: jeu.idJeu,
                        idGenre: parseInt(idGenre),
                    },
                })
            )
        );
    }

    // Associer les éditeurs (si fournis)
    if (editeurs) {
        const editeurIds = Array.isArray(editeurs) ? editeurs : [editeurs];
        await Promise.all(
            editeurIds.map((idEditeur) =>
                prisma.jeuEditeur.create({
                    data: {
                        idJeu: jeu.idJeu,
                        idEditeur: parseInt(idEditeur),
                    },
                })
            )
        );
    }

    res.redirect("/games");
});

// Afficher tous les jeux
app.get("/games", async (req, res) => {
    const games = await prisma.jeu.findMany({
        include: {
            genres: {
                include: {
                    genre: true,
                },
            },
            editeurs: {
                include: {
                    editeur: true,
                },
            },
        },
    });
    res.render("games/list", { games });
});

// Formulaire pour ajouter un jeu
app.get("/add-game", async (req, res) => {
    const genres = await prisma.genre.findMany();
    const editeurs = await prisma.editeur.findMany();
    res.render("games/add", { genres, editeurs });
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});