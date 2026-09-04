const form = document.getElementById("workoutForm");
const workoutsDiv = document.getElementById("workouts");
const searchInput = document.getElementById("search");
const totalWorkouts = document.getElementById("totalWorkouts");
const progressExercise = document.getElementById("progressExercise");
const progressData = document.getElementById("progressData");
const bestWeight = document.getElementById("bestWeight");
const latestWeight = document.getElementById("latestWeight");
const progressChart = document.getElementById("progressChart");
let allWorkouts = [];
let chart = null;

searchInput.addEventListener("input", () => {
    loadWorkouts();
});

let editingWorkoutId = null;

form.addEventListener("submit", async (e) => {

e.preventDefault();

const workout ={
    exercise: document.getElementById("exercise").value,
    sets: document.getElementById("sets").value,
    reps: document.getElementById("reps").value,
    weight: document.getElementById("weight").value
};
if (editingWorkoutId) {

    await fetch(`http://localhost:5000/workouts/${editingWorkoutId}`, {

        method: "PUT",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(workout)

    });

    editingWorkoutId = null;

    document.getElementById("submitButton").textContent = "Add Workout";

} else {

    await fetch("http://localhost:5000/workouts", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(workout)

    });

}

form.reset();

loadWorkouts();

});

async function loadWorkouts() {

    const response = await fetch("http://localhost:5000/workouts");

  const workouts = await response.json();

  allWorkouts = workouts;

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

                <button onclick="startEdit('${workout._id}', '${workout.exercise}', ${workout.sets}, ${workout.reps}, ${workout.weight})">
    Edit
</button>
            
                <button onclick="deleteWorkout('${workout._id}')">
                    Delete
                </button>

            </div>
        `;

    });

}
loadWorkouts();

async function deleteWorkout(id) {

    await fetch(`http://localhost:5000/workouts/${id}`, {
        method: "DELETE"
    });

    loadWorkouts();
}

function startEdit(id, exercise, sets, reps, weight) {


    editingWorkoutId = id;

    document.getElementById("exercise").value = exercise;
    document.getElementById("sets").value = sets;
    document.getElementById("reps").value = reps;
    document.getElementById("weight").value = weight;
    document.getElementById("submitButton").textContent = "Update Workout";

}

progressExercise.addEventListener("change", () => {

    const selectedExercise = progressExercise.value;

    const matchingWorkouts = allWorkouts
    const weights = matchingWorkouts.map(workout => workout.weight);

const best = Math.max(...weights);

const latest = matchingWorkouts[matchingWorkouts.length - 1].weight;

bestWeight.textContent = `${best} kg`;
latestWeight.textContent = `${latest} kg`;
    .filter(workout => workout.exercise === selectedExercise)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

    progressData.innerHTML = "";

   matchingWorkouts.forEach(workout => {
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

    const date = new Date(workout.date);

    const formattedDate =
        `${String(date.getDate()).padStart(2, "0")} / ${String(date.getMonth() + 1).padStart(2, "0")} / ${date.getFullYear()}`;

    progressData.innerHTML += `
        <p>
            ${formattedDate} — ${workout.weight} kg × ${workout.reps} reps
        </p>
    `;

});

});