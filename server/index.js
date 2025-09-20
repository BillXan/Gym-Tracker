
// Imports and variable declarations
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const fs = require('fs');
console.log('Credentials file exists:', fs.existsSync('/etc/secrets/credentials.json'));
const credentials = require('/etc/secrets/credentials.json'); // Use Render Secret Files path
const SPREADSHEET_ID = '1yHqwV5Zsd8tZbmu6UA-F0WJASX9hvlxin7ckLBk0NKE'; // Replace with your actual Google Sheet ID
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets('v4');
const path = require('path');

// Express app initialization and middleware
const app = express();
const PORT = 3000;
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..'))); // Serve frontend

// Route: Purge all contents of the Google Sheet
app.post('/api/clearSheet', async (req, res) => {
  try {
    console.log('Received request to clear all sheet data');
    const client = await auth.getClient();
    const clearRes = await sheets.spreadsheets.values.clear({
      auth: client,
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A2:Z', // Clears all data except the header row
    });
    console.log('Clear response:', clearRes.data);
    res.json({ success: true });
  } catch (e) {
    console.error('Error clearing sheet:', e);
    res.status(500).json({ error: 'Failed to clear sheet', details: e.message });
  }
});

// Route: Delete a specific workout from Google Sheets by matching all fields
app.post('/api/deleteWorkout', async (req, res) => {
  const workout = req.body;
  console.log('Received request to delete workout:', workout);
  try {
    const client = await auth.getClient();
    // Get all rows
    const getRes = await sheets.spreadsheets.values.get({
      auth: client,
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A2:E',
    });
    const rows = getRes.data.values || [];
    console.log('Current rows in sheet:', JSON.stringify(rows, null, 2));
    // Find matching row index
    const matchIndex = rows.findIndex(row =>
      row[0] === workout.date &&
      row[1] === workout.exercise &&
      String(row[2]) === String(workout.weight) &&
      String(row[3]) === String(workout.reps) &&
      (row[4] || '') === (workout.notes || '')
    );
    console.log('Match index:', matchIndex);
    if (matchIndex === -1) {
      console.log('Workout not found in sheet.');
      return res.status(404).json({ error: 'Workout not found in sheet' });
    }
    // Clear the matching row
    const rowNum = 2 + matchIndex; // Sheet1!A2 is first data row
    console.log(`Overwriting row ${rowNum} with ' '`);
    const updateRes = await sheets.spreadsheets.values.update({
      auth: client,
      spreadsheetId: SPREADSHEET_ID,
      range: `Sheet1!A${rowNum}:E${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[' ', ' ', ' ', ' ', ' ']] }
    });
    console.log('Update response:', JSON.stringify(updateRes.data, null, 2));
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting workout:', err);
    return res.status(500).json({ error: 'Failed to delete workout', details: err.message });
  }
});




// Load exercises from the "Exercise List" sheet
async function loadExercises() {
  console.log('Loading exercises from Exercise List sheet...');
  try {
    const client = await auth.getClient();
    console.log('Got authenticated client for exercises');
    
    const res = await sheets.spreadsheets.values.get({
      auth: client,
      spreadsheetId: SPREADSHEET_ID,
      range: 'Exercise List!A2:C', // Assumes columns: Exercise Name, Muscle Group, Weekly Target
    });
    console.log('Raw response from Exercise List sheet:', JSON.stringify(res.data, null, 2));
    
    const rows = res.data.values || [];
    console.log('Loaded exercise rows:', rows);
    console.log('Number of exercise rows:', rows.length);
    
    // Group exercises by muscle group and collect weekly targets
    const exercisesByGroup = {};
    const weeklyTargets = {};
    
    rows.forEach((row, index) => {
      console.log(`Processing row ${index}:`, row);
      const exerciseName = row[0] || '';
      const muscleGroup = row[1] || 'Other';
      const weeklyTarget = parseInt(row[2]) || 1; // Default to 1 if not specified
      
      console.log(`Row ${index}: name="${exerciseName}", group="${muscleGroup}", target=${weeklyTarget}`);
      
      if (exerciseName.trim()) {
        if (!exercisesByGroup[muscleGroup]) {
          exercisesByGroup[muscleGroup] = [];
          console.log(`Created new group: ${muscleGroup}`);
        }
        exercisesByGroup[muscleGroup].push(exerciseName);
        weeklyTargets[exerciseName] = weeklyTarget;
        console.log(`Added ${exerciseName} to ${muscleGroup} with target ${weeklyTarget}`);
      } else {
        console.log(`Row ${index}: Skipped empty exercise name`);
      }
    });
    
    console.log('Final grouped exercises:', exercisesByGroup);
    console.log('Final weekly targets:', weeklyTargets);
    
    const result = {
      exercises: exercisesByGroup,
      weeklyTargets: weeklyTargets
    };
    console.log('Returning exercises data:', JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.error('Error loading exercises from Google Sheets:', err);
    console.error('Error details:', err.message);
    console.error('Error stack:', err.stack);
    
    // Return default exercises if sheet doesn't exist or has errors
    const defaultResult = {
      exercises: {
        "Chest": ["Bench Press", "Incline Dumbbell Press", "Chest Fly"],
        "Legs": ["Squat", "Lunges", "Leg Press"],
        "Back": ["Deadlift", "Pull-Ups", "Barbell Row"],
        "Shoulders": ["Overhead Press", "Lateral Raise"],
        "Arms": ["Bicep Curl", "Tricep Pushdown"]
      },
      weeklyTargets: {
        "Bench Press":2,"Incline Dumbbell Press":1,"Chest Fly":1,"Squat":2,"Lunges":1,"Leg Press":1,"Deadlift":1,"Pull-Ups":2,"Barbell Row":1,"Overhead Press":2,"Lateral Raise":1,"Bicep Curl":2,"Tricep Pushdown":1
      }
    };
    console.log('Using default exercises due to error:', JSON.stringify(defaultResult, null, 2));
    return defaultResult;
  }
}

// Load workouts from Google Sheets
async function loadWorkouts() {
  console.log('Loading workouts from Google Sheets...');
  try {
    const client = await auth.getClient();
    const res = await sheets.spreadsheets.values.get({
      auth: client,
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A2:E', // Assumes header in row 1
    });
    const rows = res.data.values || [];
    console.log('Loaded rows:', rows);
    return rows.map(row => ({
      date: row[0] || '',
      exercise: row[1] || '',
      weight: parseFloat(row[2]) || 0,
      reps: parseInt(row[3]) || 0,
      notes: row[4] || ''
    }));
  } catch (err) {
    console.error('Error loading workouts from Google Sheets:', err);
    throw err;
  }
}

// Save all workouts to Google Sheets (overwrite)
async function saveWorkouts(workouts) {
  console.log('Saving workouts to Google Sheets...');
  console.log('Workouts:', workouts);
  const client = await auth.getClient();
  if (workouts.length === 0) {
    // Clear all rows below the header
    const clearResult = await sheets.spreadsheets.values.update({
      auth: client,
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A2:E',
      valueInputOption: 'RAW',
      requestBody: { values: [] }
    });
    console.log('Sheet cleared:', clearResult.data);
    return;
  }
  // Overwrite with new data
  const values = workouts.map(w => [w.date, w.exercise, w.weight, w.reps, w.notes]);
  console.log('Values to save:', values);
  const result = await sheets.spreadsheets.values.update({
    auth: client,
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A2',
    valueInputOption: 'RAW',
    requestBody: { values }
  });
  console.log('Save result:', result.data);

  // Clear any rows below the last workout (in case sheet had more rows before)
  const clearStartRow = 2 + values.length;
  const clearRange = `Sheet1!A${clearStartRow}:E`;
  const clearResult = await sheets.spreadsheets.values.update({
    auth: client,
    spreadsheetId: SPREADSHEET_ID,
    range: clearRange,
    valueInputOption: 'RAW',
    requestBody: { values: [] }
  });
  console.log('Cleared extra rows:', clearRange, clearResult.data);
}

// Append a single workout to Google Sheets
async function appendWorkout(workout) {
  const client = await auth.getClient();
  await sheets.spreadsheets.values.append({
    auth: client,
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A1', // Adjust as needed
    valueInputOption: 'RAW',
    requestBody: {
      values: [[workout.date, workout.exercise, workout.weight, workout.reps, workout.notes]],
    },
  });
}


// Get all exercises
app.get('/api/exercises', async (req, res) => {
  try {
    console.log('GET /api/exercises endpoint called');
    const exercises = await loadExercises();
    console.log('Loaded exercises data:', JSON.stringify(exercises, null, 2));
    res.json(exercises);
  } catch (e) {
    console.error('Error in GET /api/exercises:', e);
    res.status(500).json({ error: 'Failed to load exercises' });
  }
});

// Get all workouts
app.get('/api/workouts', async (req, res) => {
  try {
    const workouts = await loadWorkouts();
    res.json(workouts);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load workouts' });
  }
});

// Save all workouts
app.post('/api/workouts', async (req, res) => {
  try {
    const workouts = req.body;
    console.log('POST /api/workouts called with:', workouts);
    await saveWorkouts(workouts);
    res.json({ success: true });
  } catch (e) {
    console.error('Error saving workouts:', e);
    res.status(500).json({ error: 'Failed to save workouts', details: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Gym Tracker server running at http://localhost:${PORT}`);
});
