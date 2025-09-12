const form = document.getElementById('workout-form');
const logTable = document.querySelector('#log-table tbody');
const checklistCarousel = document.getElementById('checklist-carousel');
const bestsTable = document.querySelector('#bests-table tbody');
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
let chart;

// Exercises and emojis
let exercises = {
  "Chest": ["Bench Press","Incline Dumbbell Press","Chest Fly"],
  "Legs": ["Squat","Lunges","Leg Press"],
  "Back": ["Deadlift","Pull-Ups","Barbell Row"],
  "Shoulders": ["Overhead Press","Lateral Raise"],
  "Arms": ["Bicep Curl","Tricep Pushdown"]
};
const groupIcons = {"Chest":"🫀","Legs":"🦿","Back":"🏋️‍♂️","Shoulders":"🤼‍♂️","Arms":"💪"};
const weeklyTargets = {"Bench Press":2,"Incline Dumbbell Press":1,"Chest Fly":1,"Squat":2,"Lunges":1,"Leg Press":1,"Deadlift":1,"Pull-Ups":2,"Barbell Row":1,"Overhead Press":2,"Lateral Raise":1,"Bicep Curl":2,"Tricep Pushdown":1};

// Populate selects
function populateExerciseSelect(){
  exerciseSelect.innerHTML=''; filterExercise.innerHTML='<option value="">All Exercises</option>'; chartExerciseSelect.innerHTML='<option value="">All Exercises</option>';
  for(const group in exercises){
    const optgroup=document.createElement('optgroup'); optgroup.label=group;
    exercises[group].forEach(ex=>{
      const option=document.createElement('option'); option.value=ex; option.textContent=ex; optgroup.appendChild(option);
      const fOption=document.createElement('option'); fOption.value=ex; fOption.textContent=ex; filterExercise.appendChild(fOption);
      const cOption=document.createElement('option'); cOption.value=ex; cOption.textContent=ex; chartExerciseSelect.appendChild(cOption);
    });
    exerciseSelect.appendChild(optgroup);
  }
}

// Save/load from backend
async function loadData() {
  try {
    const res = await fetch('/api/workouts');
    workouts = await res.json();
    renderAll();
  } catch (e) {
    console.error('Failed to load workouts from backend', e);
  }
}

async function saveData() {
  try {
    await fetch('/api/workouts', {
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
  logTable.innerHTML='';
  let data=workouts;
  if(filter){
    if(filter.exercise) data=data.filter(w=>w.exercise===filter.exercise);
    if(filter.start) data=data.filter(w=>w.date>=filter.start);
    if(filter.end) data=data.filter(w=>w.date<=filter.end);
  }
  data.forEach((w,i)=>{
    const row=document.createElement('tr');
    row.innerHTML=`<td>${w.date}</td><td>${w.exercise}</td><td>${w.weight}</td><td>${w.reps}</td><td>${w.notes||''}</td>
    <td class="actions"><button onclick="editWorkout(${i})">Edit</button><button onclick="deleteWorkout(${i})">Delete</button></td>`;
    logTable.appendChild(row);
  });
}

function renderChecklist(){
  checklistCarousel.innerHTML='';
  const thisWeek=getWeekString(new Date());
  for(const group in exercises){
    const box=document.createElement('div'); box.className='category-box';
    let total=exercises[group].length, doneCount=0;
    exercises[group].forEach(ex=>{ const count=workouts.filter(w=>w.exercise===ex&&getWeekString(new Date(w.date))===thisWeek).length; if(count>=weeklyTargets[ex]) doneCount++; });
    const percent=Math.round((doneCount/total)*100);
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

function renderBests(){
  bestsTable.innerHTML='';
  const dataByExercise={};
  workouts.forEach(w=>{ if(!dataByExercise[w.exercise]) dataByExercise[w.exercise]=[]; dataByExercise[w.exercise].push(w); });
  for(const ex in dataByExercise){
    const arr=dataByExercise[ex]; const maxWeight=Math.max(...arr.map(a=>a.weight));
    const avgWeight=(arr.reduce((s,a)=>s+a.weight,0)/arr.length).toFixed(1);
    const avgReps=(arr.reduce((s,a)=>s+a.reps,0)/arr.length).toFixed(1);
    const row=document.createElement('tr'); row.innerHTML=`<td>${ex}</td><td>${maxWeight}</td><td>${avgWeight}</td><td>${avgReps}</td>`;
    bestsTable.appendChild(row);
  }
}

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

function renderAll(filter=null){ renderLog(filter); renderChecklist(); renderBests(); renderChart(); }

// Event listeners
form.addEventListener('submit',async e=>{
  e.preventDefault();
  const workout={date:document.getElementById('date').value,exercise:exerciseSelect.value,weight:parseFloat(document.getElementById('weight').value),reps:parseInt(document.getElementById('reps').value),notes:document.getElementById('notes').value};
  workouts.push(workout); await saveData(); renderAll(); form.reset(); dateInput.valueAsDate=new Date(); populateExerciseSelect();
});

window.editWorkout=async function(i){ const w=workouts[i]; document.getElementById('date').value=w.date; exerciseSelect.value=w.exercise; document.getElementById('weight').value=w.weight; document.getElementById('reps').value=w.reps; document.getElementById('notes').value=w.notes; workouts.splice(i,1); await saveData(); renderAll(); };
window.deleteWorkout=async function(i){ workouts.splice(i,1); await saveData(); renderAll(); };

applyFilterBtn.addEventListener('click',()=>{ renderAll({exercise:filterExercise.value,start:filterStart.value,end:filterEnd.value}); });
clearFilterBtn.addEventListener('click',()=>{ filterExercise.value=''; filterStart.value=''; filterEnd.value=''; renderAll(); });
clearAllBtn.addEventListener('click',async()=>{ if(confirm("Delete all data?")){ workouts=[]; await saveData(); renderAll(); } });
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
document.getElementById('export-csv').addEventListener('click', exportCSV);
document.getElementById('import-csv-btn').addEventListener('click', () => {
  document.getElementById('import-csv').click();
});
document.getElementById('import-csv').addEventListener('change', (e) => {
  if (e.target.files.length) importCSV(e.target.files[0]);
});

// Init
populateExerciseSelect();
loadData();

// PWA Notification
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').then(()=>console.log('SW Registered')); }
if('Notification' in window){ Notification.requestPermission(); setInterval(()=>{ if(Notification.permission==='granted'){ new Notification('🏋️ Time to update your gym log!'); } },24*60*60*1000); }
