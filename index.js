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
    const jeuxMisEnAvant = await prisma.jeu.findMany
    ({
        where: { misEnAvant: true },
        
    },);
    res.locals.jeuxMisEnAvant = jeuxMisEnAvant;
    res.render("index"); // Page d'accueil
});

// Ajouter un jeu
app.post("/add-game", async (req, res) => {
    const { titre, description, dateDeSortie, genres, editeurs, misEnAvant } = req.body;
    
    try {
        // Créer le jeu
        const jeu = await prisma.jeu.create({
            data: {
                titre,
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
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de la création du jeu");
    }
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

app.get("/delete-game", async (req, res) => {
    const { id } = req.query;
    try {
        await prisma.jeu.delete({
            where: { idJeu: parseInt(id) },
        });
        res.redirect("/games");
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de la suppression du jeu");
    }
});


// Formulaire pour ajouter un éditeur
app.get("/add-editor", (req, res) => {
    res.render("editor/addEditor");
});

// Ajouter un éditeur
app.post("/add-editor", async (req, res) => {
    const { nomEditeur } = req.body;
    
    try {
        await prisma.editeur.create({
            data: { nomEditeur },
        });
        res.redirect("/editor");
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de la création de l'éditeur");
    }
});

// Afficher tous les éditeurs
app.get("/editor", async (req, res) => {
    const editeurs = await prisma.editeur.findMany({
        include: {
            jeux: {
                include: {
                    jeu: true,
                },
            },
        },
    });
    res.render("editor/listEditor", { editeurs });
});

// Supprimer un éditeur
app.get("/delete-editor", async (req, res) => {
    const { id } = req.query;
    try {
        await prisma.editeur.delete({
            where: { idEditeur: parseInt(id) },
        });
        res.redirect("/editor");
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de la suppression de l'éditeur");
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});