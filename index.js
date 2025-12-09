const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bodyParser = require("body-parser");

const app = express();
const prisma = new PrismaClient();
const PORT = 3008;

// On définit un middleware pour parser les données des requêtes entrantes.
// Cela permet de récupérer les données envoyées via des formulaires et les rendre disponibles dans req.body.
app.get("/", (req, res) => {
    res.send("Welcome to the Task Manager API");
});

app.use(bodyParser.urlencoded({ extended: true }));

app.get("/tasks", async (req, res) => {
    const tasks = await prisma.task.findMany();
    res.json(tasks);
});

app.post("/tasks", async (req, res) => {
    const { title } = req.body;
    try {
        await prisma.task.create({
            data: { title },
        }); // Ici on ne stock pas le retour de la requête, mais on attend quand même son exécution
        res.status(201).redirect("/tasks"); // On redirige vers la page des tâches
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: "Task creation failed" });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});