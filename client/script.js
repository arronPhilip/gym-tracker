const form = document.getElementById("workoutForm");
const workoutsDiv = document.getElementById("workouts");
const searchInput = document.getElementById("search");
const totalWorkouts = document.getElementById("totalWorkouts");
const progressExercise = document.getElementById("progressExercise");
const progressData = document.getElementById("progressData");
const bestWeight = document.getElementById("bestWeight");
const latestWeight = document.getElementById("latestWeight");
const progressChart = document.getElementById("progressChart");
const progressEmptyState = document.getElementById("progressEmptyState");
const chartContainer = document.querySelector(".chart-container");
const formMessage = document.getElementById("formMessage");
const cancelEditButton = document.getElementById("cancelEditButton");
const loadingMessage = document.getElementById("loadingMessage");
const deleteModal = document.getElementById("deleteModal");
const cancelDelete = document.getElementById("cancelDelete");
const confirmDelete = document.getElementById("confirmDelete");

let workoutToDelete = null;
let allWorkouts = [];
let chart = null;

const exercisesTracked = document.getElementById("exercisesTracked");
const totalVolume = document.getElementById("totalVolume");

searchInput.addEventListener("input", () => {
    loadWorkouts();
});

let editingWorkoutId = null;

form.addEventListener("submit", async (e) => {

e.preventDefault();

const exercise = document.getElementById("exercise").value.trim();
const sets = Number(document.getElementById("sets").value);
const reps = Number(document.getElementById("reps").value);
const weight = Number(document.getElementById("weight").value);

if (!exercise) {
    formMessage.textContent = "Please enter an exercise name.";
    formMessage.style.display = "block";
    return;
}

if (sets <= 0 || reps <= 0 || weight < 0) {
    formMessage.textContent = "Please enter valid sets, reps and weight.";
    formMessage.style.display = "block";
    return;
}

formMessage.style.display = "none";

const workout = {
    exercise,
    sets,
    reps,
    weight
};
const wasEditing = Boolean(editingWorkoutId);

if (editingWorkoutId) {
    const response = await fetch(`http://localhost:5000/workouts/${editingWorkoutId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(workout)
    });

    if (!response.ok) {
        formMessage.textContent = "Failed to update workout.";
        formMessage.style.display = "block";
        return;
    }

    editingWorkoutId = null;
    document.getElementById("submitButton").textContent = "Add Workout";
    cancelEditButton.style.display = "none";


} else {
    const response = await fetch("http://localhost:5000/workouts", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(workout)
    });

    if (!response.ok) {
        formMessage.textContent = "Failed to add workout.";
        formMessage.style.display = "block";
        return;
    }
}
form.reset();

await loadWorkouts();

formMessage.textContent = wasEditing
    ? "Workout updated successfully."
    : "Workout added successfully.";

formMessage.style.display = "block";

setTimeout(() => {
    formMessage.style.display = "none";
}, 3000);
});

async function loadWorkouts() {
    try {
        loadingMessage.style.display = "block";

        const response = await fetch("http://localhost:5000/workouts");

        if (!response.ok) {
            throw new Error("Failed to load workouts.");
        }

        const workouts = await response.json();

  allWorkouts = workouts;

  const uniqueExercises = new Set(
    workouts.map(workout => workout.exercise)
);

exercisesTracked.textContent = uniqueExercises.size;

const volume = workouts.reduce((total, workout) => {
    return total + (
        Number(workout.sets) *
        Number(workout.reps) *
        Number(workout.weight)
    );
}, 0);

totalVolume.textContent = `${volume.toLocaleString()} kg`;

const exercises = [...new Set(
    workouts.map(workout => workout.exercise)
)];

const searchTerm = searchInput.value.toLowerCase();

totalWorkouts.textContent = workouts.length;

progressExercise.innerHTML = "";

const defaultOption = document.createElement("option");
defaultOption.value = "";
defaultOption.textContent = "Select Exercise";
progressExercise.appendChild(defaultOption);

exercises.forEach(exercise => {

    const option = document.createElement("option");

    option.value = exercise;
    option.textContent = exercise;

    progressExercise.appendChild(option);

});


    workoutsDiv.innerHTML = "";

    loadingMessage.style.display = "none";

    workouts.forEach(workout => {

        if (!workout.exercise.toLowerCase().includes(searchTerm)) {
    return;
}

      const date = new Date(workout.date);

const formattedDate =
    `${String(date.getDate()).padStart(2, "0")} / ${String(date.getMonth() + 1).padStart(2, "0")} / ${date.getFullYear()}`;  
        

       workoutsDiv.innerHTML += `
    <div class="workout-card">

        <h3>${workout.exercise}</h3>

        <p>Sets: ${workout.sets}</p>
        <p>Reps: ${workout.reps}</p>
        <p>Weight: ${workout.weight} kg</p>
        <p>Date: ${formattedDate}</p>

        <div class="workout-actions">

            <button onclick="startEdit('${workout._id}', '${workout.exercise}', ${workout.sets}, ${workout.reps}, ${workout.weight})">
                Edit
            </button>

            <button onclick="deleteWorkout('${workout._id}')">
                Delete
            </button>

        </div>

    </div>
`;

       });

    } catch (error) {
        loadingMessage.style.display = "none";
        formMessage.textContent = "Unable to connect to the server.";
        formMessage.style.display = "block";
    }
}

loadWorkouts();

async function deleteWorkout(id) {
    workoutToDelete = id;
    deleteModal.style.display = "flex";
}
cancelDelete.addEventListener("click", () => {
    workoutToDelete = null;
    deleteModal.style.display = "none";
});

confirmDelete.addEventListener("click", async () => {
    if (!workoutToDelete) return;

    try {
        const response = await fetch(
            `http://localhost:5000/workouts/${workoutToDelete}`,
            {
                method: "DELETE"
            }
        );

        if (!response.ok) {
            throw new Error("Failed to delete workout.");
        }

        deleteModal.style.display = "none";
        workoutToDelete = null;

        await loadWorkouts();

    } catch (error) {
        deleteModal.style.display = "none";
        workoutToDelete = null;

        formMessage.textContent = "Failed to delete workout.";
        formMessage.style.display = "block";
    }
});

function startEdit(id, exercise, sets, reps, weight) {
    editingWorkoutId = id;

    document.getElementById("exercise").value = exercise;
    document.getElementById("sets").value = sets;
    document.getElementById("reps").value = reps;
    document.getElementById("weight").value = weight;

    document.getElementById("submitButton").textContent = "Update Workout";
    cancelEditButton.style.display = "inline-block";
}

cancelEditButton.addEventListener("click", () => {
    editingWorkoutId = null;

    form.reset();

    document.getElementById("submitButton").textContent = "Add Workout";

    cancelEditButton.style.display = "none";

    formMessage.style.display = "none";
});



progressExercise.addEventListener("change", () => {

    const selectedExercise = progressExercise.value;

    if (selectedExercise === "") {
    chartContainer.style.display = "none";
} else {
    chartContainer.style.display = "block";
}

    progressEmptyState.style.display =
    selectedExercise === "" ? "flex" : "none";

    const matchingWorkouts = allWorkouts
        .filter(workout => workout.exercise === selectedExercise)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    progressData.innerHTML = "";

    if (matchingWorkouts.length === 0) {
        bestWeight.textContent = "-";
        latestWeight.textContent = "-";

        if (chart) {
            chart.destroy();
            chart = null;
        }

        return;
    }

    matchingWorkouts.forEach(workout => {

        const date = new Date(workout.date);

        const formattedDate =
            `${String(date.getDate()).padStart(2, "0")} / ${String(date.getMonth() + 1).padStart(2, "0")} / ${date.getFullYear()}`;

        progressData.innerHTML += `
            <p>
                ${formattedDate} — ${workout.weight} kg × ${workout.reps} reps
            </p>
        `;
    });

    const weights = matchingWorkouts.map(workout => workout.weight);

    const best = Math.max(...weights);
    const latest = matchingWorkouts[matchingWorkouts.length - 1].weight;

    bestWeight.textContent = `${best} kg`;
    latestWeight.textContent = `${latest} kg`;

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(progressChart, {
        type: "line",

        data: {
            labels: matchingWorkouts.map(workout => {

                const date = new Date(workout.date);

                return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
            }),

            datasets: [{
                label: "Weight (kg)",
                data: matchingWorkouts.map(workout => workout.weight),
                tension: 0.3,
                pointRadius: 5
            }]
        },

        options: {
            responsive: true,

            scales: {
                y: {
                    title: {
                        display: true,
                        text: "Weight (kg)"
                    }
                },

                x: {
                    title: {
                        display: true,
                        text: "Date"
                    }
                }
            }
        }
    });


});