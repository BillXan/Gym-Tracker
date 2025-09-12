const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

const app = express();
const PORT = 3000;
const CSV_FILE = path.join(__dirname, 'workouts.csv');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..'))); // Serve frontend

// Load workouts from CSV
function loadWorkouts() {
  if (!fs.existsSync(CSV_FILE)) return [];
  const data = fs.readFileSync(CSV_FILE, 'utf8');
  const records = parse(data, { columns: true, skip_empty_lines: true });
  return records;
}

// Save workouts to CSV
function saveWorkouts(workouts) {
  const csv = stringify(workouts, { header: true, columns: ['date','exercise','weight','reps','notes'] });
  fs.writeFileSync(CSV_FILE, csv);
}

// Get all workouts
app.get('/api/workouts', (req, res) => {
  res.json(loadWorkouts());
});

// Save all workouts
app.post('/api/workouts', (req, res) => {
  const workouts = req.body;
  saveWorkouts(workouts);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Gym Tracker server running at http://localhost:${PORT}`);
});
