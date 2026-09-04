const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Workout = require("./models/Workout");

require("dotenv").config();


const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));


app.get("/", (req, res) => {
    res.send("Gym Tracker API Running");
});

app.listen(5000, () => {
    console.log("Server running on port 5000");
});


app.post("/workouts", async (req, res) => {

    try{

        const newWorkout = new Workout(req.body);

        await newWorkout.save();

        res.status(201).json(newWorkout);
    } catch (error) {
        res.status(500).json({message: error.message });
    }
});

app.get("/workouts", async (req, res) => {

    try{
        const workouts = await Workout.find();
        res.json(workouts);

    } catch (error) {
        res.status(500).json({ message: error.message});
    }
});
app.delete("/workouts/:id", async (req, res) => {
    try {
        const { id } = req.params;

        await Workout.findByIdAndDelete(id);

        res.json({ message: "Workout deleted" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put("/workouts/:id", async (req, res) => {

    try {

        const updatedWorkout = await Workout.findByIdAndUpdate(

            req.params.id,

            req.body,

            { new: true }

        );

        res.json(updatedWorkout);

    } catch (error) {

        res.status(500).json({ message: error.message });

    }

});
    

