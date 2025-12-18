/**
 * Serveur Express pour l'application Vapeur (clone de Steam)
 * Gère toutes les routes pour les jeux, genres et éditeurs
 */

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const prisma = new PrismaClient();
const PORT = 3008;

const hbs = require("hbs");

// ===================================================
// CONFIGURATION DE HANDLEBARS
// ===================================================

app.set("view engine", "hbs"); // Définir Handlebars comme moteur de template
app.set("views", path.join(__dirname, "views")); // Définir le dossier des vues
hbs.registerPartials(path.join(__dirname, "views", "partials")); // Enregistrer les partials (header, footer, etc.)

// Helper Handlebars pour vérifier si une valeur est dans un tableau
hbs.registerHelper("includes", (collection, value) => {
    if (!Array.isArray(collection)) {
        return false;
    }
    const target = Number(value);
    return collection.some((item) => Number(item) === target);
});

// ===================================================
// MIDDLEWARES
// ===================================================

app.use(bodyParser.urlencoded({ extended: true })); // Parser les données de formulaire
app.use(express.static(path.join(__dirname, "public"))); // Servir les fichiers statiques (CSS, images, etc.)

// ===================================================
// ROUTES - PAGE D'ACCUEIL
// ===================================================

/**
 * GET / - Affiche la page d'accueil avec les jeux mis en avant
 */
app.get("/", async (req, res) => {
    const jeuxMisEnAvant = await prisma.jeu.findMany({
        where: { misEnAvant: true }
    });
    res.locals.jeuxMisEnAvant = jeuxMisEnAvant;
    res.render("index");
});

// ===================================================
// ROUTES - GESTION DES JEUX
// ===================================================

/**
 * POST /add-game - Créer un nouveau jeu
 * Associe les genres et éditeurs sélectionnés
 */
app.post("/add-game", async (req, res) => {
    const { titre, description, dateDeSortie, genres, editeurs, misEnAvant } = req.body;
    
    try {
        // 1. Créer le jeu
        const jeu = await prisma.jeu.create({
            data: {
                titre,
                description,
                dateDeSortie: dateDeSortie ? new Date(dateDeSortie) : new Date(),
                misEnAvant: misEnAvant === "on" || misEnAvant === "true"
            }
        });

        // 2. Associer les genres sélectionnés
        if (genres) {
            const genreIds = Array.isArray(genres) ? genres : [genres];
            await Promise.all(
                genreIds.map((idGenre) =>
                    prisma.jeuGenre.create({
                        data: { idJeu: jeu.idJeu, idGenre: parseInt(idGenre) }
                    })
                )
            );
        }

        // 3. Associer les éditeurs sélectionnés
        if (editeurs) {
            const editeurIds = Array.isArray(editeurs) ? editeurs : [editeurs];
            await Promise.all(
                editeurIds.map((idEditeur) =>
                    prisma.jeuEditeur.create({
                        data: { idJeu: jeu.idJeu, idEditeur: parseInt(idEditeur) }
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

/**
 * GET /games - Affiche tous les jeux avec leurs genres et éditeurs
 */
app.get("/games", async (req, res) => {
    const games = await prisma.jeu.findMany({
        include: {
            genres: { include: { genre: true } },
            editeurs: { include: { editeur: true } }
        }
    });
    res.render("games/listGames", { games });
});

/**
 * GET /games/:id - Affiche le détail d'un jeu spécifique
 */
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

        // Formater la date pour l'affichage
        const formattedDate = jeu.dateDeSortie
            ? new Date(jeu.dateDeSortie).toLocaleDateString("fr-FR")
            : "";

        res.render("games/showGame", { jeu, formattedDate });
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors du chargement du jeu");
    }
});

/**
 * GET /add-game - Affiche le formulaire d'ajout d'un jeu
 */
app.get("/add-game", async (req, res) => {
    const genres = await prisma.genre.findMany();
    const editeurs = await prisma.editeur.findMany();
    res.render("games/addGame", { genres, editeurs });
});

/**
 * GET /delete-game - Supprime un jeu
 */
app.get("/delete-game", async (req, res) => {
    const { id } = req.query;
    try {
        await prisma.jeu.delete({
            where: { idJeu: parseInt(id) }
        });
        res.redirect("/games");
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de la suppression du jeu");
    }
});

/**
 * GET /edit-game - Affiche le formulaire de modification d'un jeu
 */
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
        
        // Récupérer les IDs des genres et éditeurs pour pré-cocher les checkboxes
        const selectedGenres = jeu.genres.map(jg => jg.idGenre);
        const selectedEditeurs = jeu.editeurs.map(je => je.idEditeur);
        
        // Formater la date pour l'input de type date
        const formattedDateDeSortie = jeu.dateDeSortie
            ? new Date(jeu.dateDeSortie).toISOString().split("T")[0]
            : "";
        
        res.render("games/editGame", { 
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

/**
 * POST /edit-game - Met à jour un jeu existant
 */
app.post("/edit-game", async (req, res) => {
    const { id, titre, description, dateDeSortie, genres, editeurs, misEnAvant } = req.body;
    
    try {
        // 1. Mettre à jour les informations du jeu
        await prisma.jeu.update({
            where: { idJeu: parseInt(id) },
            data: {
                titre,
                description,
                dateDeSortie: dateDeSortie ? new Date(dateDeSortie) : new Date(),
                misEnAvant: misEnAvant === "on" || misEnAvant === "true"
            }
        });

        // 2. Supprimer les anciennes associations de genres
        await prisma.jeuGenre.deleteMany({
            where: { idJeu: parseInt(id) }
        });

        // 3. Créer les nouvelles associations de genres
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

        // 4. Supprimer les anciennes associations d'éditeurs
        await prisma.jeuEditeur.deleteMany({
            where: { idJeu: parseInt(id) }
        });

        // 5. Créer les nouvelles associations d'éditeurs
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
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de la modification du jeu");
    }
});

// ===================================================
// ROUTES - GESTION DES ÉDITEURS
// ===================================================

/**
 * GET /add-editor - Affiche le formulaire d'ajout d'un éditeur
 */
app.get("/add-editor", (req, res) => {
    res.render("editors/addEditor");
});

/**
 * POST /add-editor - Créer un nouvel éditeur
 */
app.post("/add-editor", async (req, res) => {
    const { nomEditeur } = req.body;
    
    try {
        await prisma.editeur.create({
            data: { nomEditeur }
        });
        res.redirect("/editors");
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de la création de l'éditeur");
    }
});

/**
 * GET /editors - Affiche tous les éditeurs avec leurs jeux
 */
app.get("/editors", async (req, res) => {
    const editeurs = await prisma.editeur.findMany({
        include: {
            jeux: { include: { jeu: true } }
        }
    });
    res.render("editors/listEditor", { editeurs });
});

/**
 * GET /editors/:id/games - Affiche tous les jeux d'un éditeur
 */
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

        // Extraire les jeux de la relation
        const jeux = editeur.jeux.map((jeuEditeur) => jeuEditeur.jeu);
        res.render("editors/editorGames", { editeur, jeux });
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors du chargement des jeux de l'éditeur");
    }
});

/**
 * GET /delete-editor - Supprime un éditeur
 */
app.get("/delete-editor", async (req, res) => {
    const { id } = req.query;
    try {
        await prisma.editeur.delete({
            where: { idEditeur: parseInt(id) }
        });
        res.redirect("/editors");
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors de la suppression de l'éditeur");
    }
});

/**
 * GET /edit-editor - Affiche le formulaire de modification d'un éditeur
 */
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

/**
 * POST /edit-editor - Met à jour un éditeur existant
 */
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

// ===================================================
// ROUTES - GESTION DES GENRES
// ===================================================

/**
 * GET /genres - Affiche tous les genres
 */
app.get("/genres", async (req, res) => {
    const listegenre = await prisma.genre.findMany();
    res.render("genres/list_genre", { listegenre });
});


/**
 * GET /genres/:id/games - Affiche tous les jeux d'un genre (nouvelle route)
 */
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

        // Extraire les jeux de la relation
        const jeux = genre.jeux.map((jeuGenre) => jeuGenre.jeu);
        res.render("genres/genreGames", { genre, jeux });
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors du chargement des jeux du genre");
    }
});

// ===================================================
// INITIALISATION - SEED DES GENRES PAR DÉFAUT
// ===================================================

/**
 * Fonction pour initialiser les genres par défaut dans la base de données
 * Utilise upsert pour éviter les doublons
 */
async function seedGenres() {
    const defaultGenres = [
        "Action",
        "Aventure",
        "RPG",
        "Simulation",
        "Sport",
        "MMORPG"
        
    ];

    for (const nomGenre of defaultGenres) {
        await prisma.genre.upsert({
            where: { nomGenre },
            update: {}, // Ne rien faire si le genre existe déjà
            create: { nomGenre } // Créer le genre s'il n'existe pas
        });
    }
}

// ===================================================
// GESTION DES ERREURS
// ===================================================

/**
 * Middleware 404 - Capture toutes les routes non définies
 */
app.use((req, res) => {
    res.status(404).render("errors/404", {
        url: req.originalUrl
    });
});

// ===================================================
// DÉMARRAGE DU SERVEUR
// ===================================================

/**
 * Fonction asynchrone pour initialiser la base de données et démarrer le serveur
 */
(async () => {
    try {
        await seedGenres(); // Initialiser les genres par défaut
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("Erreur lors de l'initialisation :", err);
        process.exit(1);
    }
})();


