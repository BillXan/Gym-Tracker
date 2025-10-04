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
    console.log('No exercises loaded from sheet - exercise selects will be empty');
    // Add a placeholder option indicating no exercises are available
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'No exercises available - check Exercise List sheet';
    placeholderOption.disabled = true;
    exerciseSelect.appendChild(placeholderOption);
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
    
    // Set empty exercises if backend fails
    console.log('Setting empty exercises due to backend failure');
    exercises = {};
    weeklyTargets = {};
    console.log('Empty exercises set:', exercises);
    console.log('Empty weeklyTargets set:', weeklyTargets);
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

  // Get muscle group from loaded exercises data (consistent with Exercise List sheet)
  function getExerciseGroup(exName) {
    console.log('[CreativeWorkout] looking up group for:', exName);
    // Search through all exercise groups to find which group contains this exercise
    for (const group in exercises) {
      if (exercises[group].includes(exName)) {
        console.log('[CreativeWorkout] found', exName, 'in group', group);
        return group;
      }
    }
    // Fallback if exercise not found in loaded list
    console.log('[CreativeWorkout] exercise not found in loaded list, defaulting to Other');
    return 'Other';
  }

  // Creative Today's Workout Generator using backend data
  function getTodaysCreativeWorkout() {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    console.log('[CreativeWorkout] Today:', today);
    console.log('[CreativeWorkout] Yesterday:', yesterday);
    console.log('[CreativeWorkout] Workouts array:', workouts);
    // Use all exercises from the weekly checklist
    const allExercises = [];
    for (const group in exercises) {
      exercises[group].forEach(ex => allExercises.push(ex));
    }
    console.log('[CreativeWorkout] All exercises from weekly checklist:', allExercises);
    // Find completed exercises for today and yesterday
    const completedToday = new Set(workouts.filter(w => w.date === today).map(w => w.exercise));
    const completedYesterday = new Set(workouts.filter(w => w.date === yesterday).map(w => w.exercise));
    console.log('[CreativeWorkout] Completed today:', Array.from(completedToday));
    console.log('[CreativeWorkout] Completed yesterday:', Array.from(completedYesterday));
    // Group uncompleted exercises by their defined group from Exercise List
    const pool = {};
    allExercises.forEach(ex => {
      if (!completedToday.has(ex) && !completedYesterday.has(ex)) {
        const group = getExerciseGroup(ex);
        console.log('[CreativeWorkout] Adding', ex, 'to group', group);
        if (!pool[group]) pool[group] = [];
        pool[group].push(ex);
      } else {
        if (completedToday.has(ex)) {
          console.log('[CreativeWorkout] Skipping exercise completed today:', ex);
        }
        if (completedYesterday.has(ex)) {
          console.log('[CreativeWorkout] Skipping exercise completed yesterday:', ex);
        }
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
    // Build workout list, alternating groups, limited to max 8 exercises
    const result = [];
    let lastGroup = null;
    const maxExercises = 8 - completedToday.size; // Adjust max based on already completed today
    while (groups.length > 0 && result.length < maxExercises) {
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
    console.log('[CreativeWorkout] Final generated list (max 8):', result);
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
      li.style.cursor = 'pointer';
      li.style.padding = '5px';
      li.style.borderRadius = '3px';
      li.style.transition = 'background-color 0.2s';
      
      // Add hover effect
      li.addEventListener('mouseenter', () => {
        li.style.backgroundColor = '#f0f0f0';
      });
      li.addEventListener('mouseleave', () => {
        li.style.backgroundColor = '';
      });
      
      // Add click handler to select exercise
      li.addEventListener('click', () => {
        console.log('Clicked on exercise:', item.exercise);
        exerciseSelect.value = item.exercise;
        // Trigger the auto-fill function
        autoFillExerciseStats();
        // Visual feedback
        li.style.backgroundColor = '#d4edda';
        setTimeout(() => {
          li.style.backgroundColor = '';
        }, 1000);
      });
      
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
function getWeekString(date){ 
  const d = new Date(date);
  
  // Get Monday of the current week
  const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days, otherwise go back to Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  
  // Format as YYYY-MM-DD for the Monday of this week
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Carousel state
let currentLogDate = new Date().toISOString().slice(0, 10);

// Get all unique dates with workouts
function getWorkoutDates() {
  const dates = [...new Set(workouts.map(w => w.date))].sort().reverse(); // Most recent first
  if (dates.length === 0) {
    return [new Date().toISOString().slice(0, 10)]; // Include today even if no workouts
  }
  // Include today if not already in the list
  const today = new Date().toISOString().slice(0, 10);
  if (!dates.includes(today)) {
    dates.unshift(today);
  }
  return dates;
}

// Navigate carousel
function navigateLogCarousel(direction) {
  const dates = getWorkoutDates();
  const currentIndex = dates.indexOf(currentLogDate);
  
  if (direction === 'prev' && currentIndex < dates.length - 1) {
    currentLogDate = dates[currentIndex + 1];
  } else if (direction === 'next' && currentIndex > 0) {
    currentLogDate = dates[currentIndex - 1];
  }
  
  renderLog();
}

// Render functions
function renderLog(filter=null){
  // Use carousel date if no filter is provided
  let targetDate = currentLogDate;
  
  // If filter is provided, use traditional filtering instead of carousel
  if (filter) {
    logTable.innerHTML = '';
    // Add header row
    const header = document.createElement('tr');
    logTable.appendChild(header);

    let data = workouts.filter(w => {
      if (filter.exercise && w.exercise !== filter.exercise) return false;
      if (filter.start && w.date < filter.start) return false;
      if (filter.end && w.date > filter.end) return false;
      return true;
    });

    if (!Array.isArray(data) || data.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="6">No workouts found for the selected filters.</td>';
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
    return;
  }

  // Carousel mode - show workouts for specific date
  logTable.innerHTML = '';
  
  // Add date display row
  const dateRow = document.createElement('tr');
  dateRow.innerHTML = `
    <td colspan="6" style="text-align: center; padding: 15px; background-color: #23262f; border-bottom: 1px solid #444; color: #fff; font-size: 1.3em; font-weight: 500;">
      ${formatDateForDisplay(targetDate)}
    </td>
  `;
  logTable.appendChild(dateRow);
  
  // Add carousel navigation controls (below date, above headers)
  const navHeader = document.createElement('tr');
  navHeader.innerHTML = `
    <td colspan="6" style="text-align: center; padding: 10px; background-color: #23262f; border-bottom: 2px solid #23262f;">
      <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
        <button onclick="navigateLogCarousel('prev')" style="padding: 5px 10px; background: #23262f; color: white; border: 1px solid white; border-color: #444; border-radius: 8px; cursor: pointer;">← Previous</button>
        <span style="margin: 0; font-size: 1em;">Navigate</span>
        <button onclick="navigateLogCarousel('next')" style="padding: 5px 10px; background: #23262f; color: white; border: 1px solid white; border-color: #444; border-radius: 8px; cursor: pointer;">Next →</button>
      </div>
      <div style="margin-top: 5px; font-size: 0.9em; color: #666;">
        ${getCurrentDateInfo()}
      </div>
    </td>
  `;
  logTable.appendChild(navHeader);
  
  // Add table headers
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = `
    <th style="background-color: #23262f; color: #fff; padding: 10px; border-bottom: 1px solid #444;">Date</th>
    <th style="background-color: #23262f; color: #fff; padding: 10px; border-bottom: 1px solid #444;">Exercise</th>
    <th style="background-color: #23262f; color: #fff; padding: 10px; border-bottom: 1px solid #444;">Weight</th>
    <th style="background-color: #23262f; color: #fff; padding: 10px; border-bottom: 1px solid #444;">Reps</th>
    <th style="background-color: #23262f; color: #fff; padding: 10px; border-bottom: 1px solid #444;">Notes</th>
    <th style="background-color: #23262f; color: #fff; padding: 10px; border-bottom: 1px solid #444;">Actions</th>
  `;
  logTable.appendChild(headerRow);

  // Filter workouts for the current date
  const data = workouts.filter(w => w.date === targetDate);

  if (data.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="6" style="text-align: center; padding: 20px; color: #666;">No workouts logged for ${formatDateForDisplay(targetDate)}</td>`;
    logTable.appendChild(row);
    return;
  }

  data.forEach((w) => {
    // Find the original index in the workouts array for edit/delete functions
    const originalIndex = workouts.findIndex(workout => 
      workout.date === w.date && 
      workout.exercise === w.exercise && 
      workout.weight === w.weight && 
      workout.reps === w.reps && 
      workout.notes === w.notes
    );
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${w.date || ''}</td>
      <td>${w.exercise || ''}</td>
      <td>${w.weight || ''}</td>
      <td>${w.reps || ''}</td>
      <td>${w.notes || ''}</td>
      <td class="actions">
        <button onclick="editWorkout(${originalIndex})">Edit</button>
        <button onclick="deleteWorkout(${originalIndex})">Delete</button>
      </td>
    `;
    logTable.appendChild(row);
  });
}

// Helper functions for carousel
function formatDateForDisplay(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (dateString === today.toISOString().slice(0, 10)) {
    return 'Today (' + date.toLocaleDateString() + ')';
  } else if (dateString === yesterday.toISOString().slice(0, 10)) {
    return 'Yesterday (' + date.toLocaleDateString() + ')';
  } else {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
}

function getCurrentDateInfo() {
  const dates = getWorkoutDates();
  const currentIndex = dates.indexOf(currentLogDate);
  return `Showing ${currentIndex + 1} of ${dates.length} days with workouts`;
}

// Touch/swipe functionality for carousel
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;

function handleTouchStart(e) {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}

function handleTouchEnd(e) {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipe();
}

function handleSwipe() {
  const swipeThreshold = 50; // Minimum distance for a swipe
  const maxVerticalDistance = 100; // Maximum vertical movement to still count as horizontal swipe
  
  const horizontalDistance = touchEndX - touchStartX;
  const verticalDistance = Math.abs(touchEndY - touchStartY);
  
  // Only trigger swipe if horizontal movement is significant and vertical movement is minimal
  if (Math.abs(horizontalDistance) > swipeThreshold && verticalDistance < maxVerticalDistance) {
    if (horizontalDistance > 0) {
      // Swipe right - go to previous (older) date
      navigateLogCarousel('prev');
    } else {
      // Swipe left - go to next (more recent) date
      navigateLogCarousel('next');
    }
  }
}

// Mouse drag functionality for desktop
let mouseStartX = 0;
let mouseEndX = 0;
let isDragging = false;

function handleMouseDown(e) {
  mouseStartX = e.clientX;
  isDragging = true;
  e.preventDefault(); // Prevent text selection
}

function handleMouseMove(e) {
  if (!isDragging) return;
  e.preventDefault();
}

function handleMouseUp(e) {
  if (!isDragging) return;
  
  mouseEndX = e.clientX;
  const dragDistance = mouseEndX - mouseStartX;
  const dragThreshold = 50;
  
  if (Math.abs(dragDistance) > dragThreshold) {
    if (dragDistance > 0) {
      // Drag right - go to previous (older) date
      navigateLogCarousel('prev');
    } else {
      // Drag left - go to next (more recent) date
      navigateLogCarousel('next');
    }
  }
  
  isDragging = false;
}

// Add swipe listeners to the log table
function addSwipeListeners() {
  const logContainer = logTable.parentElement; // Get the table container
  
  // Touch events for mobile
  logContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
  logContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
  
  // Mouse events for desktop
  logContainer.addEventListener('mousedown', handleMouseDown);
  logContainer.addEventListener('mousemove', handleMouseMove);
  logContainer.addEventListener('mouseup', handleMouseUp);
  logContainer.addEventListener('mouseleave', () => { isDragging = false; }); // Stop dragging if mouse leaves area
  
  // Add some visual feedback
  logContainer.style.cursor = 'grab';
  logContainer.addEventListener('mousedown', () => {
    logContainer.style.cursor = 'grabbing';
  });
  logContainer.addEventListener('mouseup', () => {
    logContainer.style.cursor = 'grab';
  });
}

// Make navigation functions global
window.navigateLogCarousel = navigateLogCarousel;

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

// Add new exercise functionality
async function addNewExercise(exerciseName, muscleGroup, weeklyTarget) {
  try {
    console.log('Adding new exercise:', { exerciseName, muscleGroup, weeklyTarget });
    const response = await fetch(`${API_BASE}/api/addExercise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exerciseName: exerciseName,
        muscleGroup: muscleGroup,
        weeklyTarget: weeklyTarget
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Exercise added successfully:', result);
    
    // Reload exercises to update the dropdown
    await loadExercises();
    
    return true;
  } catch (e) {
    console.error('Failed to add exercise:', e);
    alert('Failed to add exercise: ' + e.message);
    return false;
  }
}

// Modal functionality
function showExerciseModal() {
  document.getElementById('exercise-modal').style.display = 'block';
}

function hideExerciseModal() {
  document.getElementById('exercise-modal').style.display = 'none';
  // Clear form
  document.getElementById('new-exercise-form').reset();
}

// Event listeners for new exercise functionality
document.getElementById('add-exercise-btn').addEventListener('click', showExerciseModal);
document.getElementById('cancel-exercise').addEventListener('click', hideExerciseModal);

// Handle new exercise form submission
document.getElementById('new-exercise-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const exerciseName = document.getElementById('new-exercise-name').value.trim();
  const muscleGroup = document.getElementById('new-muscle-group').value.trim();
  const weeklyTarget = parseInt(document.getElementById('new-weekly-target').value) || 1;
  
  if (!exerciseName || !muscleGroup) {
    alert('Please fill in exercise name and muscle group');
    return;
  }
  
  const success = await addNewExercise(exerciseName, muscleGroup, weeklyTarget);
  if (success) {
    hideExerciseModal();
    // Select the newly added exercise
    const exerciseSelect = document.getElementById('exercise');
    exerciseSelect.value = exerciseName;
    alert('Exercise added successfully!');
  }
});

// Close modal when clicking outside
document.getElementById('exercise-modal').addEventListener('click', (e) => {
  if (e.target.id === 'exercise-modal') {
    hideExerciseModal();
  }
});

// Auto-fill function for exercise selection
function autoFillExerciseStats() {
  const selectedExercise = exerciseSelect.value;
  if (!selectedExercise) {
    // Clear fields if no exercise selected
    document.getElementById('weight').value = '';
    document.getElementById('reps').value = '';
    return;
  }

  // Find the most recent workout for this exercise
  const exerciseWorkouts = workouts
    .filter(w => w.exercise === selectedExercise)
    .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending

  if (exerciseWorkouts.length > 0) {
    const lastWorkout = exerciseWorkouts[0];
    document.getElementById('weight').value = lastWorkout.weight || '';
    document.getElementById('reps').value = lastWorkout.reps || '';
    document.getElementById('notes').value = lastWorkout.notes || '';
    console.log('Auto-filled stats for', selectedExercise, ':', {
      weight: lastWorkout.weight,
      reps: lastWorkout.reps,
      lastDate: lastWorkout.date
    });
  } else {
    // Clear fields if no previous workouts found
    document.getElementById('weight').value = '';
    document.getElementById('reps').value = '';
  }
}

// Event listeners
exerciseSelect.addEventListener('change', autoFillExerciseStats);

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

// Initialize swipe functionality after page loads
document.addEventListener('DOMContentLoaded', () => {
  addSwipeListeners();
});

// PWA Notification
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').then(()=>console.log('SW Registered')); }
if('Notification' in window){ Notification.requestPermission(); setInterval(()=>{ if(Notification.permission==='granted'){ new Notification('🏋️ Time to update your gym log!'); } },24*60*60*1000); }
