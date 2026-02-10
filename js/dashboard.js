/**
 * DRAGON CHASE - Dashboard Logic
 */

const DATA_URL = '/api/data';
const FALLBACK_URL = './data/cohort-1.json';

// Avatar path prefix
const AVATAR_PATH = './assets/avatars/';

let cohortData = null;

/**
 * Load cohort data from API (with fallback to JSON file)
 */
async function loadData() {
  try {
    let response = await fetch(DATA_URL);
    if (!response.ok) {
      console.log('API not available, using fallback JSON');
      response = await fetch(FALLBACK_URL);
    }
    cohortData = await response.json();
    renderDashboard();
  } catch (error) {
    console.error('Failed to load data:', error);
    document.body.innerHTML = '<div class="container"><h1>ERROR LOADING DATA</h1></div>';
  }
}

/**
 * Get all tasks from nested weeks structure
 */
function getAllTasks() {
  const tasks = [];
  cohortData.weeks.forEach(week => {
    week.sections.forEach(section => {
      section.tasks.forEach(task => {
        tasks.push({ ...task, week: week.week });
      });
    });
  });
  return tasks;
}

/**
 * Calculate total points for a student
 */
function getStudentPoints(studentId) {
  const checkins = cohortData.checkins[studentId] || [];
  const allTasks = getAllTasks();
  return allTasks
    .filter(task => checkins.includes(task.id))
    .reduce((sum, task) => sum + task.points, 0);
}

/**
 * Get max possible points
 */
function getMaxPoints() {
  return getAllTasks().reduce((sum, task) => sum + task.points, 0);
}

/**
 * Calculate dragon position (0-100%)
 */
function getDragonPosition() {
  // Fixed position for demo
  return 20;
}

/**
 * Calculate student position (0-100%)
 */
function getStudentPosition(studentId) {
  const points = getStudentPoints(studentId);
  const maxPoints = getMaxPoints();
  return (points / maxPoints) * 100;
}

/**
 * Get student state based on dragon proximity
 */
function getStudentState(studentId) {
  const studentPos = getStudentPosition(studentId);
  const dragonPos = getDragonPosition();
  const diff = studentPos - dragonPos;

  if (studentPos >= 100) return 'victory';
  if (diff < -5) return 'bitten';
  if (diff < 10) return 'stressed';
  return 'fresh';
}

/**
 * Render the progress bar
 */
function renderProgressBar() {
  const track = document.getElementById('progress-track');
  if (!track) return;

  track.innerHTML = '';

  // Dragon position
  const dragonPos = getDragonPosition();

  // Danger zone (red area behind dragon, +8% to reach dragon's head)
  const dangerWidth = Math.min(dragonPos + 8, 100);
  const safeWidth = Math.max(100 - dangerWidth - 10, 0);
  track.innerHTML += `
    <div class="danger-zone" style="width: ${dangerWidth}%"></div>
    <div class="safe-zone" style="width: ${safeWidth}%"></div>
    <div class="zone-label danger">Danger Zone</div>
    <div class="zone-label safe">Safe Zone</div>
  `;

  // Week markers
  track.innerHTML += `
    <div class="week-markers">
      <div class="week-marker">Week 1</div>
      <div class="week-marker">Week 2</div>
      <div class="week-marker">Week 3</div>
    </div>
  `;

  // Finish line
  track.innerHTML += `
    <div class="finish-line"></div>
  `;

  // Find leader (most points)
  const leaderPoints = Math.max(...cohortData.students.map(s => getStudentPoints(s.id)));

  // Student lanes
  let lanesHtml = '<div class="student-lanes">';
  cohortData.students.forEach((student) => {
    const pos = getStudentPosition(student.id);
    const state = getStudentState(student.id);
    const avatarSrc = AVATAR_PATH + student.avatar;
    const points = getStudentPoints(student.id);
    const isLeader = points === leaderPoints && points > 0;

    const inDanger = state === 'stressed' || state === 'bitten';
    lanesHtml += `
      <div class="student-lane">
        <div class="student-marker state-${state} ${isLeader ? 'leader' : ''}" style="left: ${pos}%">
          <div class="avatar">
            <img src="${avatarSrc}" alt="${student.name}">
          </div>
          <div class="name">${student.name}</div>
          ${isLeader ? '<div class="crown">👑</div>' : ''}
          ${inDanger ? '<div class="panic">😱</div>' : ''}
        </div>
      </div>
    `;
  });
  lanesHtml += '</div>';
  track.innerHTML += lanesHtml;

  // Dragon - attack mode if anyone is stressed or bitten
  const anyoneInDanger = cohortData.students.some(s => {
    const state = getStudentState(s.id);
    return state === 'stressed' || state === 'bitten';
  });
  const dragonSprite = anyoneInDanger
    ? './assets/Blood Dragon Sprite Attack.png'
    : './assets/Blood Dragon Sprite Base.png';

  track.innerHTML += `
    <div class="dragon-lane">
      <div class="dragon ${anyoneInDanger ? 'attacking' : ''}" style="left: ${dragonPos}%">
        <img src="${dragonSprite}" alt="Dragon">
      </div>
    </div>
  `;
}

/**
 * Render the checkins table with new structure
 */
function renderCheckinsTable() {
  const table = document.getElementById('checkins-table');
  if (!table) return;

  const maxPoints = getMaxPoints();
  const studentCount = cohortData.students.length;

  let html = `
    <thead>
      <tr>
        <th class="task-col"></th>
        ${cohortData.students.map(s => `<th class="student-col">${s.name}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
  `;

  cohortData.weeks.forEach(week => {
    // Week header
    html += `
      <tr class="week-header">
        <td colspan="${studentCount + 1}">НЕДЕЛЯ ${week.week}: ${week.title}</td>
      </tr>
    `;

    week.sections.forEach(section => {
      if (section.type === 'call') {
        // Call section - boxed header
        const dateStr = section.date ? ` (${section.date})` : '';
        html += `
          <tr class="call-header">
            <td class="call-title">${section.title}${dateStr}</td>
            ${cohortData.students.map(() => '<td></td>').join('')}
          </tr>
        `;

        // Call tasks (usually just attendance)
        section.tasks.forEach(task => {
          html += renderTaskRow(task);
        });
      } else if (section.type === 'homework') {
        // Homework section - indented
        html += `
          <tr class="homework-header">
            <td class="homework-title" colspan="${studentCount + 1}">${section.title}:</td>
          </tr>
        `;

        section.tasks.forEach(task => {
          html += renderTaskRow(task, true);
        });
      }
    });
  });

  // Totals row
  html += `
    <tr class="totals-row">
      <td><strong>ИТОГО</strong></td>
      ${cohortData.students.map(student => {
        const points = getStudentPoints(student.id);
        return `<td class="total-score">${points}/${maxPoints}</td>`;
      }).join('')}
    </tr>
  `;

  html += `</tbody>`;
  table.innerHTML = html;
}

/**
 * Render a single task row
 */
function renderTaskRow(task, indent = false) {
  let html = `<tr class="${indent ? 'homework-task' : 'call-task'}">`;
  html += `<td class="task-name ${indent ? 'indented' : ''}">${task.title}</td>`;

  cohortData.students.forEach(student => {
    const checkins = cohortData.checkins[student.id] || [];
    const done = checkins.includes(task.id);
    html += `
      <td>
        <span class="check ${done ? 'done' : 'pending'}">${done ? '✓' : '○'}</span>
      </td>
    `;
  });

  html += `</tr>`;
  return html;
}

/**
 * Render entire dashboard
 */
function renderDashboard() {
  document.getElementById('cohort-name').textContent = cohortData.cohort;

  const start = new Date(cohortData.startDate).toLocaleDateString('ru-RU');
  const end = new Date(cohortData.endDate).toLocaleDateString('ru-RU');
  document.getElementById('cohort-dates').textContent = `${start} — ${end}`;

  renderProgressBar();
  renderCheckinsTable();
}

// Initialize
document.addEventListener('DOMContentLoaded', loadData);
