
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
