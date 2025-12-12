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
hbs.registerHelper("includes", (collection, value) => {
    if (!Array.isArray(collection)) {
        return false;
    }

    const target = Number(value);
    return collection.some((item) => Number(item) === target);
});

app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
    const jeuxMisEnAvant = await prisma.jeu.findMany
    ({
        where: { misEnAvant: true }
    });
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
                misEnAvant: misEnAvant === "on" || misEnAvant === "true"
            }
        });

    // Associer les genres (si fournis)
    if (genres) {
        const genreIds = Array.isArray(genres) ? genres : [genres];
        await Promise.all(
            genreIds.map((idGenre) =>
                prisma.jeuGenre.create({
                    data: { idJeu: jeu.idJeu,
                        idGenre: parseInt(idGenre)}
            }))
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
                        idEditeur: parseInt(idEditeur)}
                })
            )
        );
    }

        res.redirect("/games");
    } 
    catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de la création du jeu");
    }
});

// Afficher tous les jeux
app.get("/games", async (req, res) => {
    const games = await prisma.jeu.findMany({
        include: 
        {
            genres: {include: {genre: true}},
            editeurs: {include: {editeur: true}}
        }
    });
    res.render("games/list", { games });
});

// Afficher le détail d'un jeu
app.get("/games/:id", async (req, res) => {
    const gameId = parseInt(req.params.id, 10);

    if (Number.isNaN(gameId)) {
        return res.status(400).send("Identifiant de jeu invalide");
    }

    try {
        const jeu = await prisma.jeu.findUnique({
            where: { idJeu: gameId },
            include: {
                genres: { include: { genre: true } },
                editeurs: { include: { editeur: true } }
            }
        });

        if (!jeu) {
            return res.status(404).send("Jeu introuvable");
        }

        const formattedDate = jeu.dateDeSortie
            ? new Date(jeu.dateDeSortie).toLocaleDateString("fr-FR")
            : "";

        res.render("games/show", { jeu, formattedDate });
    }
    catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors du chargement du jeu");
    }
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
            where: { idJeu: parseInt(id) }
        });
        res.redirect("/games");
    } 
    catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de la suppression du jeu");
    }
});

// Formulaire pour modifier un jeu
app.get("/edit-game", async (req, res) => {
    const { id } = req.query;
    try {
        const jeu = await prisma.jeu.findUnique({
            where: { idJeu: parseInt(id) },
            include: {
                genres: { include: { genre: true } },
                editeurs: { include: { editeur: true } }
            }
        });

        if (!jeu) {
            return res.status(404).send("Jeu non trouvé");
        }
        
        const genres = await prisma.genre.findMany();
        const editeurs = await prisma.editeur.findMany();
        
        // Créer des tableaux d'IDs pour pré-cocher les cases
        const selectedGenres = jeu.genres.map(jg => jg.idGenre);
        const selectedEditeurs = jeu.editeurs.map(je => je.idEditeur);
        const formattedDateDeSortie = jeu.dateDeSortie
            ? new Date(jeu.dateDeSortie).toISOString().split("T")[0]
            : "";
        
        res.render("games/edit", { 
            jeu, 
            genres, 
            editeurs, 
            selectedGenres, 
            selectedEditeurs,
            formattedDateDeSortie
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors du chargement du jeu");
    }
});

// Modifier le jeu
app.post("/edit-game", async (req, res) => {
    const { id, titre, description, dateDeSortie, genres, editeurs, misEnAvant } = req.body;
    
    try {
        // Mettre à jour le jeu
        await prisma.jeu.update({
            where: { idJeu: parseInt(id) },
            data: {
                titre,
                description,
                dateDeSortie: dateDeSortie ? new Date(dateDeSortie) : new Date(),
                misEnAvant: misEnAvant === "on" || misEnAvant === "true"
            }
        });

        // Supprimer les anciennes associations de genres
        await prisma.jeuGenre.deleteMany({
            where: { idJeu: parseInt(id) }
        });

        // Créer les nouvelles associations de genres
        if (genres) {
            const genreIds = Array.isArray(genres) ? genres : [genres];
            await Promise.all(
                genreIds.map((idGenre) =>
                    prisma.jeuGenre.create({
                        data: { 
                            idJeu: parseInt(id),
                            idGenre: parseInt(idGenre)
                        }
                    })
                )
            );
        }

        // Supprimer les anciennes associations d'éditeurs
        await prisma.jeuEditeur.deleteMany({
            where: { idJeu: parseInt(id) }
        });

        // Créer les nouvelles associations d'éditeurs
        if (editeurs) {
            const editeurIds = Array.isArray(editeurs) ? editeurs : [editeurs];
            await Promise.all(
                editeurIds.map((idEditeur) =>
                    prisma.jeuEditeur.create({
                        data: {
                            idJeu: parseInt(id),
                            idEditeur: parseInt(idEditeur)
                        }
                    })
                )
            );
        }

        res.redirect("/games");
    } 
    catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de la modification du jeu");
    }
});

// Formulaire pour ajouter un éditeur
app.get("/add-editor", (req, res) => {
    res.render("editors/addEditor");
});

// Ajouter un éditeur
app.post("/add-editor", async (req, res) => {
    const { nomEditeur } = req.body;
    
    try {
        await prisma.editeur.create({
            data: { nomEditeur }
        });
        res.redirect("/editors");
    } 
    catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de la création de l'éditeur");
    }
});

// Afficher tous les éditeurs et les jeux auquels ils sotn associé
app.get("/editors", async (req, res) => {
    const editeurs = await prisma.editeur.findMany({
        include: 
        {
            jeux: {include: {jeu: true}}
        }
    });
    res.render("editors/listEditor", { editeurs });
});

// Afficher les jeux associés à un genre
app.get("/genres/:id/games", async (req, res) => {
    const genreId = parseInt(req.params.id, 10);

    if (Number.isNaN(genreId)) {
        return res.status(400).send("Identifiant de genre invalide");
    }

    try {
        const genre = await prisma.genre.findUnique({
            where: { idGenre: genreId },
            include: {
                jeux: {
                    include: {
                        jeu: {
                            include: {
                                genres: { include: { genre: true } },
                                editeurs: { include: { editeur: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!genre) {
            return res.status(404).send("Genre introuvable");
        }

        const jeux = genre.jeux.map((jeuGenre) => jeuGenre.jeu);
        res.render("genres/genreGames", { genre, jeux });
    }
    catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors du chargement des jeux du genre");
    }
});

// Afficher les jeux publiés par un éditeur donné
app.get("/editors/:id/games", async (req, res) => {
    const editorId = parseInt(req.params.id, 10);

    if (Number.isNaN(editorId)) {
        return res.status(400).send("Identifiant d'éditeur invalide");
    }

    try {
        const editeur = await prisma.editeur.findUnique({
            where: { idEditeur: editorId },
            include: {
                jeux: {
                    include: {
                        jeu: {
                            include: {
                                genres: { include: { genre: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!editeur) {
            return res.status(404).send("Éditeur introuvable");
        }

        const jeux = editeur.jeux.map((jeuEditeur) => jeuEditeur.jeu);
        res.render("editors/editorGames", { editeur, jeux });
    }
    catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors du chargement des jeux de l'éditeur");
    }
});

// Supprimer un éditeur
app.get("/delete-editor", async (req, res) => {
    const { id } = req.query;
    try {
        await prisma.editeur.delete({
            where: { idEditeur: parseInt(id) }
        });
        res.redirect("/editors");
    } 
    catch (error) 
    {
        console.error(error);
        res.status(500).send("Erreur lors de la suppression de l'éditeur");
    }
});

// Formulaire pour modifier un éditeur
app.get("/edit-editor", async (req, res) => {
    const { id } = req.query;
    try {
        const editeur = await prisma.editeur.findUnique({
            where: { idEditeur: parseInt(id) },
            include: {
                jeux: { include: { jeu: true } }
            }
        });
        
        if (!editeur) {
            return res.status(404).send("Éditeur non trouvé");
        }
        
        res.render("editors/editEditor", { editeur });
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors du chargement de l'éditeur");
    }
});

// Modifier un éditeur
app.post("/edit-editor", async (req, res) => {
    const { id, nomEditeur } = req.body;
    
    try {
        await prisma.editeur.update({
            where: { idEditeur: parseInt(id) },
            data: { nomEditeur }
        });
        
        res.redirect("/editors");
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de la modification de l'éditeur");
    }
});



// Afficher tous les genres
app.get("/genres", async (req, res) => {
    const listegenre = await prisma.genre.findMany();
    res.render("genres/list_genre", { listegenre });
});

// Afficher tous les jeux d'un genre spécifique
app.get("/genres/:id/jeux", async (req, res) => {
    const { id } = req.params;
    try {
        const genreAvecJeux = await prisma.genre.findUnique({
            where: { idGenre: parseInt(id) },
            include: {
                jeux: {
                    include: { jeu: true }
                }
            }
        });
        // Préparer les données pour le template `list-genre-jeu.hbs`
        const nomGenre = genreAvecJeux ? genreAvecJeux.nomGenre : "";
        const listejeu = genreAvecJeux && genreAvecJeux.jeux ? genreAvecJeux.jeux.map(gj => gj.jeu) : [];
        res.render("genres/list-genre-jeu", { nomGenre, listejeu });
    }
    catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de la récupération des jeux pour ce genre");
    }
});


// Seed des genres par défaut si nécessaire
async function seedGenres() {
    const defaultGenres = [
        "Action",
        "Aventure",
        "RPG",
        "Stratégie",
        "Simulation"
    ];

    for (const nomGenre of defaultGenres) {
        await prisma.genre.upsert({
            where: { nomGenre },
            update: {},
            create: { nomGenre }
        });
    }
}

(async () => {
    try {
        await seedGenres();
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("Erreur lors de l'initialisation :", err);
        process.exit(1);
    }
})();