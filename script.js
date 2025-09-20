const form = document.getElementById('workout-form');
const logTable = document.querySelector('#log-table tbody');
const checklistCarousel = document.getElementById('checklist-carousel');
// Removed bestsTable since personal bests section is gone
const ctx = document.getElementById('progressChart').getContext('2d');
const exerciseSelect = document.getElementById('exercise');
const dateInput = document.getElementById('date');
const filterExercise = document.getElementById('filter-exercise');
const filterStart = document.getElementById('filter-start');
const filterEnd = document.getElementById('filter-end');
const applyFilterBtn = document.getElementById('apply-filter');
const clearFilterBtn = document.getElementById('clear-filter');
const clearAllBtn = document.getElementById('clear-all');
const chartTypeSelect = document.getElementById('chart-type');
const chartExerciseSelect = document.getElementById('chart-exercise');

dateInput.valueAsDate = new Date();
let workouts = [];
let exercises = {}; // Will be loaded from backend
let chart;

// Exercises and weekly targets will be loaded from backend
const groupIcons = {"Chest":"🫀","Legs":"🦿","Back":"🏋️‍♂️","Shoulders":"🤼‍♂️","Arms":"💪"};
let weeklyTargets = {}; // Will be loaded from backend

// Populate selects
function populateExerciseSelect(){
  console.log('populateExerciseSelect called');
  console.log('Current exercises object:', exercises);
  console.log('Exercises keys:', Object.keys(exercises));
  
  exerciseSelect.innerHTML=''; 
  filterExercise.innerHTML='<option value="">All Exercises</option>'; 
  chartExerciseSelect.innerHTML='<option value="">All Exercises</option>';
  
  // Only populate if exercises are loaded
  if (!exercises || Object.keys(exercises).length === 0) {
    console.log('No exercises loaded yet, skipping populate');
    return;
  }
  
  for(const group in exercises){
    console.log(`Processing group: ${group}, exercises:`, exercises[group]);
    const optgroup=document.createElement('optgroup'); 
    optgroup.label=group;
    exercises[group].forEach(ex=>{
      console.log(`Adding exercise: ${ex} to group: ${group}`);
      const option=document.createElement('option'); 
      option.value=ex; 
      option.textContent=ex; 
      optgroup.appendChild(option);
      
      const fOption=document.createElement('option'); 
      fOption.value=ex; 
      fOption.textContent=ex; 
      filterExercise.appendChild(fOption);
      
      const cOption=document.createElement('option'); 
      cOption.value=ex; 
      cOption.textContent=ex; 
      chartExerciseSelect.appendChild(cOption);
    });
    exerciseSelect.appendChild(optgroup);
    console.log(`Added optgroup for ${group} with ${exercises[group].length} exercises`);
  }
  console.log('populateExerciseSelect completed');
}

// Save/load from backend
const API_BASE = 'https://gym-tracker-rmhb.onrender.com';

async function loadExercises() {
  console.log('Loading exercises from backend...');
  try {
    console.log('Fetching from:', `${API_BASE}/api/exercises`);
    const res = await fetch(`${API_BASE}/api/exercises`);
    console.log('Response status:', res.status);
    console.log('Response ok:', res.ok);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    console.log('Raw data received from backend:', data);
    console.log('Data type:', typeof data);
    console.log('Data structure:', JSON.stringify(data, null, 2));
    
    if (data.exercises) {
      exercises = data.exercises;
      console.log('Set exercises to:', exercises);
    } else {
      console.error('No exercises property in response data');
      exercises = data; // Fallback in case structure is different
    }
    
    if (data.weeklyTargets) {
      weeklyTargets = data.weeklyTargets;
      console.log('Set weeklyTargets to:', weeklyTargets);
    } else {
      console.error('No weeklyTargets property in response data');
    }
    
    console.log('Final exercises object:', exercises);
    console.log('Final weeklyTargets object:', weeklyTargets);
    
    populateExerciseSelect(); // Refresh exercise selects after loading
  } catch (e) {
    console.error('Failed to load exercises from backend', e);
    console.error('Error message:', e.message);
    console.error('Error stack:', e.stack);
    
    // Fallback to default exercises
    console.log('Using fallback exercises');
    exercises = {
      "Chest": ["Bench Press","Incline Dumbbell Press","Chest Fly"],
      "Legs": ["Squat","Lunges","Leg Press"],
      "Back": ["Deadlift","Pull-Ups","Barbell Row"],
      "Shoulders": ["Overhead Press","Lateral Raise"],
      "Arms": ["Bicep Curl","Tricep Pushdown"]
    };
    weeklyTargets = {
      "Bench Press":2,"Incline Dumbbell Press":1,"Chest Fly":1,"Squat":2,"Lunges":1,"Leg Press":1,"Deadlift":1,"Pull-Ups":2,"Barbell Row":1,"Overhead Press":2,"Lateral Raise":1,"Bicep Curl":2,"Tricep Pushdown":1
    };
    console.log('Fallback exercises set:', exercises);
    console.log('Fallback weeklyTargets set:', weeklyTargets);
    populateExerciseSelect();
  }
}

async function loadData() {
  console.log('=== Starting loadData() ===');
  try {
    // Load both exercises and workouts
    console.log('About to call loadExercises()');
    await loadExercises();
    console.log('loadExercises() completed');
    
    console.log('About to fetch workouts from:', `${API_BASE}/api/workouts`);
    const res = await fetch(`${API_BASE}/api/workouts`);
    console.log('Workouts response status:', res.status);
    
    workouts = await res.json();
    console.log('Loaded workouts from backend:', workouts);
    console.log('Number of workouts:', workouts.length);
    
    console.log('About to call renderAll()');
    renderAll();
    console.log('=== loadData() completed successfully ===');
  } catch (e) {
    console.error('Failed to load data:', e);
    console.error('Error in loadData():', e.message);
  }
}

  // Infer muscle group from exercise name
  function inferGroup(exName) {
  const name = exName.toLowerCase();
  console.log('[CreativeWorkout] inferring group for:', exName);
  if (name.match(/bench|chest|fly|pec/)) { console.log('[CreativeWorkout] inferred Chest'); return 'Chest'; }
  if (name.match(/squat|lunge|leg press|calf|quad|hamstring/)) { console.log('[CreativeWorkout] inferred Legs'); return 'Legs'; }
  if (name.match(/deadlift|pull-up|row|lat|back/)) { console.log('[CreativeWorkout] inferred Back'); return 'Back'; }
  if (name.match(/press|shoulder|raise|shrug/)) { console.log('[CreativeWorkout] inferred Shoulders'); return 'Shoulders'; }
  if (name.match(/curl|tricep|bicep|arm/)) { console.log('[CreativeWorkout] inferred Arms'); return 'Arms'; }
  console.log('[CreativeWorkout] inferred Other');
  return 'Other';
  }

  // Creative Today's Workout Generator using backend data
  function getTodaysCreativeWorkout() {
    const today = new Date().toISOString().slice(0, 10);
    console.log('[CreativeWorkout] Today:', today);
    console.log('[CreativeWorkout] Workouts array:', workouts);
    // Use all exercises from the weekly checklist
    const allExercises = [];
    for (const group in exercises) {
      exercises[group].forEach(ex => allExercises.push(ex));
    }
    console.log('[CreativeWorkout] All exercises from weekly checklist:', allExercises);
    // Find completed exercises for today
    const completed = new Set(workouts.filter(w => w.date === today).map(w => w.exercise));
    console.log('[CreativeWorkout] Completed today:', Array.from(completed));
    // Group uncompleted exercises by inferred group
    const pool = {};
    allExercises.forEach(ex => {
      if (!completed.has(ex)) {
        const group = inferGroup(ex);
        console.log('[CreativeWorkout] Adding', ex, 'to group', group);
        if (!pool[group]) pool[group] = [];
        pool[group].push(ex);
      } else {
        console.log('[CreativeWorkout] Skipping completed exercise:', ex);
      }
    });
    console.log('[CreativeWorkout] Pool of uncompleted exercises by group:', pool);
    // Shuffle muscle groups for variety
    const groups = Object.keys(pool).filter(g => pool[g].length > 0);
    console.log('[CreativeWorkout] Groups available:', groups);
    for (let i = groups.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [groups[i], groups[j]] = [groups[j], groups[i]];
    }
    console.log('[CreativeWorkout] Groups after shuffle:', groups);
    // Build workout list, alternating groups
    const result = [];
    let lastGroup = null;
    while (groups.length > 0) {
      let idx = groups.findIndex(g => g !== lastGroup);
      if (idx === -1) idx = 0;
      const group = groups[idx];
      console.log('[CreativeWorkout] Picking group:', group);
      const exIdx = Math.floor(Math.random() * pool[group].length);
      const exercise = pool[group][exIdx];
      console.log('[CreativeWorkout] Picked exercise:', exercise);
      result.push({ group, exercise });
      lastGroup = group;
      pool[group].splice(exIdx, 1);
      if (pool[group].length === 0) {
        console.log('[CreativeWorkout] Group', group, 'is now empty, removing');
        groups.splice(idx, 1);
      }
    }
    console.log('[CreativeWorkout] Final generated list:', result);
    return result;
  }

  function renderTodaysCreativeWorkout() {
    const listContainer = document.getElementById('creative-workout-list');
    if (!listContainer) {
      console.warn('[CreativeWorkout] creative-workout-list div not found!');
      return;
    }
    const list = getTodaysCreativeWorkout();
    console.log('[CreativeWorkout] List to render:', list);
    if (list.length === 0) {
      listContainer.innerHTML = '<p>All exercises completed for today! 🎉</p>';
      console.log('[CreativeWorkout] All exercises completed for today!');
      return;
    }
    // Get previous items
    const prevLis = Array.from(listContainer.querySelectorAll('li'));
    // Build new list
    const ul = document.createElement('ul');
    list.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `<b>${item.exercise}</b> <span style="color:gray">(${item.group})</span>`;
      ul.appendChild(li);
    });
    // Fade out all previous items
    prevLis.forEach(prevLi => {
      prevLi.classList.add('fade-out');
      setTimeout(() => {
        if (prevLi.parentNode) prevLi.parentNode.removeChild(prevLi);
      }, 500);
    });
    // After fade-out, fade in new items
    setTimeout(() => {
      listContainer.innerHTML = '';
      Array.from(ul.children).forEach(li => {
        li.classList.add('fade-in');
      });
      listContainer.appendChild(ul);
    }, prevLis.length ? 500 : 0);
    console.log('[CreativeWorkout] Rendered creative workout UI with', list.length, 'items');
  }

  // Render creative workout on load and after data changes
  function renderAll(filter=null){ renderLog(filter); renderChecklist(); renderChart(); renderTodaysCreativeWorkout(); }

async function saveData() {
  try {
    await fetch(`${API_BASE}/api/workouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workouts)
    });
  } catch (e) {
    console.error('Failed to save workouts to backend', e);
  }
}
function getWeekString(date){ const d=new Date(date),y=d.getFullYear(); const w=Math.ceil((((d-new Date(y,0,1))/86400000)+new Date(y,0,1).getDay()+1)/7); return y+'-W'+w; }

// Render functions
function renderLog(filter=null){
  // Completely reprogrammed workout log rendering
  logTable.innerHTML = '';
  // Add header row
  const header = document.createElement('tr');
  //header.innerHTML = '<th>Date</th><th>Exercise</th><th>Weight</th><th>Reps</th><th>Notes</th><th>Actions</th>';
  logTable.appendChild(header);

  let data = workouts;
  if (filter) {
    data = data.filter(w => {
      if (filter.exercise && w.exercise !== filter.exercise) return false;
      if (filter.start && w.date < filter.start) return false;
      if (filter.end && w.date > filter.end) return false;
      return true;
    });
  }

  if (!Array.isArray(data) || data.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="6">No workouts logged yet.</td>';
    logTable.appendChild(row);
    return;
  }

  data.forEach((w, i) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${w.date || ''}</td>
      <td>${w.exercise || ''}</td>
      <td>${w.weight || ''}</td>
      <td>${w.reps || ''}</td>
      <td>${w.notes || ''}</td>
      <td class="actions">
        <button onclick="editWorkout(${i})">Edit</button>
        <button onclick="deleteWorkout(${i})">Delete</button>
      </td>
    `;
    logTable.appendChild(row);
  });
}

function renderChecklist(){
  checklistCarousel.innerHTML='';
  const thisWeek=getWeekString(new Date());
  // Calculate overall weekly checklist percentage
  let totalRequired=0, totalDone=0;
  for(const group in exercises){
    exercises[group].forEach(ex=>{
      const maxCount=weeklyTargets[ex]||1;
      totalRequired += maxCount;
      const count=workouts.filter(w=>w.exercise===ex&&getWeekString(new Date(w.date))===thisWeek).length;
      totalDone += Math.min(count, maxCount);
    });
  }
  const overallPercent = totalRequired === 0 ? 0 : Math.round((totalDone/totalRequired)*100);

  // Add header with overall percent
  const header = document.createElement('h2');
  header.innerHTML = `Weekly Checklist <span class="done" style="font-size:1em; margin-left:10px;">✅ ${overallPercent}%</span>`;
  checklistCarousel.appendChild(header);

  for(const group in exercises){
    const box=document.createElement('div'); box.className='category-box';
    let groupRequired=0, groupDone=0;
    exercises[group].forEach(ex=>{
      const maxCount=weeklyTargets[ex]||1;
      groupRequired += maxCount;
      const count=workouts.filter(w=>w.exercise===ex&&getWeekString(new Date(w.date))===thisWeek).length;
      groupDone += Math.min(count, maxCount);
    });
    const percent=Math.round((groupDone/groupRequired)*100);
    const title=document.createElement('h3'); title.innerHTML=`${groupIcons[group]||''} ${group} - ✅ ${percent}% done`;
    box.appendChild(title);
    exercises[group].forEach(ex=>{
      const count=workouts.filter(w=>w.exercise===ex && getWeekString(new Date(w.date))===thisWeek).length;
      const maxCount=weeklyTargets[ex]||1;
      const icon=ex.includes('Press')?'🏋️':ex.includes('Curl')?'💪':ex.includes('Fly')?'🕊️':ex.includes('Squat')?'🦵':ex.includes('Lunges')?'🦵':ex.includes('Deadlift')?'⚡':ex.includes('Pull')?'⬆️':ex.includes('Row')?'↔️':'🏃';
      const li=document.createElement('div'); li.innerHTML=`${icon} ${ex}: <span class="${count>=maxCount?'done':'missing'}">${count} / ${maxCount}</span>`;
      box.appendChild(li);
    });
    checklistCarousel.appendChild(box);
  }
}

// Removed renderBests since personal bests section is gone

function renderChart(){
  if (chart) {
    chart.destroy();
    chart = null;
  }
  const type = chartTypeSelect.value;
  const exerciseFilter = chartExerciseSelect.value;
  const dataByExercise = {};
  workouts.forEach(w => {
    if (exerciseFilter && w.exercise !== exerciseFilter) return;
    if (!dataByExercise[w.exercise]) dataByExercise[w.exercise] = [];
    dataByExercise[w.exercise].push({ x: w.date, y: w[type] });
  });
  const datasets = Object.keys(dataByExercise).map(ex => ({
    label: ex,
    data: dataByExercise[ex],
    borderWidth: 2,
    fill: false,
    borderColor: `hsl(${Math.floor(Math.random() * 360)},70%,50%)`
  }));
  if (datasets.length > 0) {
    chart = new Chart(ctx, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        scales: {
          x: { type: 'time', time: { unit: 'week' } },
          y: { beginAtZero: true }
        }
      }
    });
  }
}

function renderAll(filter=null){ renderLog(filter); renderChecklist(); renderChart(); renderTodaysCreativeWorkout(); }

// Event listeners
form.addEventListener('submit',async e=>{
  e.preventDefault();
  const workout={date:document.getElementById('date').value,exercise:exerciseSelect.value,weight:parseFloat(document.getElementById('weight').value),reps:parseInt(document.getElementById('reps').value),notes:document.getElementById('notes').value};
  workouts.push(workout); await saveData(); renderAll(); form.reset(); dateInput.valueAsDate=new Date(); populateExerciseSelect();
});

window.editWorkout=async function(i){ const w=workouts[i]; document.getElementById('date').value=w.date; exerciseSelect.value=w.exercise; document.getElementById('weight').value=w.weight; document.getElementById('reps').value=w.reps; document.getElementById('notes').value=w.notes; workouts.splice(i,1); await saveData(); renderAll(); };
window.deleteWorkout=async function(i){
  const deleted = workouts[i];
  workouts.splice(i,1);
  // Send deleted workout to backend for precise row deletion
  try {
    await fetch(`${API_BASE}/api/deleteWorkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deleted)
    });
    console.log('Requested backend to delete workout:', deleted);
  } catch (e) {
    console.error('Failed to request backend workout deletion', e);
  }
  await saveData();
  renderAll();
};

applyFilterBtn.addEventListener('click',()=>{ renderAll({exercise:filterExercise.value,start:filterStart.value,end:filterEnd.value}); });
clearFilterBtn.addEventListener('click',()=>{ filterExercise.value=''; filterStart.value=''; filterEnd.value=''; renderAll(); });
clearAllBtn.addEventListener('click',async()=>{
  if(confirm("Delete all data?")){
    console.log('[DeleteAll] Sending request to clearSheet endpoint...');
    const res = await fetch(`${API_BASE}/api/clearSheet`, { method: 'POST' });
    console.log('[DeleteAll] Response:', res);
    if (res.ok) {
      workouts=[];
      console.log('[DeleteAll] Workouts array cleared, rendering UI...');
      renderAll();
    } else {
      const err = await res.text();
      console.error('[DeleteAll] Error clearing sheet:', err);
      alert('Failed to clear sheet: ' + err);
    }
  }
});
chartTypeSelect.addEventListener('change',renderChart);
chartExerciseSelect.addEventListener('change',renderChart);

// CSV Export
function exportCSV() {
  const header = ["date","exercise","weight","reps","notes"];
  const rows = workouts.map(w => [w.date, w.exercise, w.weight, w.reps, w.notes ? '"' + w.notes.replace(/"/g, '""') + '"' : ""]);
  const csv = [header.join(",")].concat(rows.map(r => r.join(","))).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "workouts.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// CSV Import
function importCSV(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const lines = text.trim().split(/\r?\n/);
    const header = lines[0].split(",");
    const newWorkouts = lines.slice(1).map(line => {
      // Handle quoted notes
      const match = line.match(/^(.*?),(.*?),(.*?),(.*?),(".*"|.*)$/);
      if (!match) return null;
      let [_, date, exercise, weight, reps, notes] = match;
      notes = notes.replace(/^"|"$/g, '').replace(/""/g, '"');
      return { date, exercise, weight: parseFloat(weight), reps: parseInt(reps), notes };
    }).filter(Boolean);
    workouts = newWorkouts;
    saveData();
    renderAll();
  };
  reader.readAsText(file);
}

// CSV UI Event Listeners
/*document.getElementById('export-csv').addEventListener('click', exportCSV);
document.getElementById('import-csv-btn').addEventListener('click', () => {
  document.getElementById('import-csv').click();
});
document.getElementById('import-csv').addEventListener('change', (e) => {
  if (e.target.files.length) importCSV(e.target.files[0]);
});
*/
// Init
loadData(); // This will load exercises first, then workouts, and populate selects

// PWA Notification
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').then(()=>console.log('SW Registered')); }
if('Notification' in window){ Notification.requestPermission(); setInterval(()=>{ if(Notification.permission==='granted'){ new Notification('🏋️ Time to update your gym log!'); } },24*60*60*1000); }
