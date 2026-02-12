/**
 * DRAGON CHASE - Dashboard Logic
 */

const DATA_URL = '/api/data';
const FALLBACK_URL = './data/cohort-1.json';

// Avatar path prefix
const AVATAR_PATH = './assets/avatars/';

// Dragon mechanics
const DRAGON_EXPONENT = 2.5;
const DRAGON_MAX = 90; // dragon reaches 90%, not 100% — rescue zone

// Dragon sprite animation (asymmetric: base 3s, laser 1s)
const DRAGON_SPRITE_BASE = './assets/Blood Dragon Sprite Base.png';
const DRAGON_SPRITE_LASER = './assets/Blood Dragon Sprite Attack.png';
const DRAGON_BASE_MS = 4000;
const DRAGON_LASER_MS = 2000;

// Bonus points for all students (hotfix)
const BONUS_POINTS = 10;

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
  const taskPoints = allTasks
    .filter(task => checkins.includes(task.id))
    .reduce((sum, task) => sum + task.points, 0);
  return taskPoints + BONUS_POINTS;
}

/**
 * Get max possible points
 */
function getMaxPoints() {
  return getAllTasks().reduce((sum, task) => sum + task.points, 0) + BONUS_POINTS;
}

/**
 * Calculate dragon position (0–DRAGON_MAX%) with accelerating pace
 */
function getDragonPosition() {
  const now = new Date();
  const start = new Date(cohortData.startDate + 'T00:00:00');
  const end = new Date(cohortData.endDate + 'T23:59:59');
  if (now <= start) return 0;
  if (now >= end) return DRAGON_MAX;
  const elapsed = (now - start) / (end - start); // 0..1
  return Math.pow(elapsed, DRAGON_EXPONENT) * DRAGON_MAX;
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
 * Get student state based on ratio to dragon position
 */
function getStudentState(studentId) {
  const studentPos = getStudentPosition(studentId);
  const dragonPos = getDragonPosition();

  if (studentPos >= 100) return 'victory';
  if (dragonPos < 5) return 'fresh'; // course just started

  const ratio = studentPos / dragonPos;
  if (ratio >= 0.9) return 'fresh';    // 90%+ of dragon
  if (ratio >= 0.6) return 'stressed'; // 60-89% of dragon
  return 'bitten';                      // < 60% of dragon
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

  // Dragon with 2-frame sprite animation
  track.innerHTML += `
    <div class="dragon-lane">
      <div class="dragon" style="left: ${dragonPos}%">
        <img id="dragon-sprite" src="${DRAGON_SPRITE_BASE}" alt="Dragon">
      </div>
    </div>
  `;

  startDragonAnimation();
}

let dragonAnimTimer = null;
function startDragonAnimation() {
  if (dragonAnimTimer) clearTimeout(dragonAnimTimer);
  function showBase() {
    const img = document.getElementById('dragon-sprite');
    if (!img) return;
    img.src = DRAGON_SPRITE_BASE;
    dragonAnimTimer = setTimeout(showLaser, DRAGON_BASE_MS);
  }
  function showLaser() {
    const img = document.getElementById('dragon-sprite');
    if (!img) return;
    img.src = DRAGON_SPRITE_LASER;
    dragonAnimTimer = setTimeout(showBase, DRAGON_LASER_MS);
  }
  dragonAnimTimer = setTimeout(showLaser, DRAGON_BASE_MS);
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

// ===========================================
// MUSIC PLAYER
// ===========================================

const MUSIC_BASE_URL = 'https://archive.org/download/far_cry_blood_dragon_ost/';

const MUSIC_PLAYLIST = [
  { file: '02. Blood Dragon Theme.mp3', title: 'Blood Dragon Theme' },
  { file: '01. Rex Colt.mp3', title: 'Rex Colt' },
  { file: '07. Power Core.mp3', title: 'Power Core' },
  { file: '04. Warzone.mp3', title: 'Warzone' },
  { file: '10. Sloan\'s Assault.mp3', title: 'Sloan\'s Assault' },
  { file: '12. Combat I.mp3', title: 'Combat I' },
  { file: '13. Combat II.mp3', title: 'Combat II' },
  { file: '14. Combat III.mp3', title: 'Combat III' },
  { file: '16. Omega Force.mp3', title: 'Omega Force' },
  { file: '24. Resurrection.mp3', title: 'Resurrection' },
];

let musicCurrentIndex = 0;
let musicIsPlaying = false;

function initMusicPlayer() {
  const audio = document.getElementById('music-audio');
  const toggleBtn = document.getElementById('music-toggle');
  const prevBtn = document.getElementById('music-prev');
  const nextBtn = document.getElementById('music-next');
  const trackName = document.getElementById('music-track-name');
  const volumeSlider = document.getElementById('music-volume');

  if (!audio || !toggleBtn) return;

  // Restore saved state
  const savedVolume = localStorage.getItem('music-volume');
  const savedTrack = localStorage.getItem('music-track');
  if (savedVolume !== null) {
    volumeSlider.value = savedVolume;
    audio.volume = savedVolume / 100;
  } else {
    audio.volume = 0.3;
  }
  if (savedTrack !== null) {
    musicCurrentIndex = Math.min(parseInt(savedTrack, 10), MUSIC_PLAYLIST.length - 1);
  }

  updateTrackDisplay();

  // Autoplay on page load
  loadTrack(musicCurrentIndex);
  audio.play().then(() => {
    musicIsPlaying = true;
    toggleBtn.textContent = '⏸';
    toggleBtn.classList.add('playing');
  }).catch(() => {
    // Browser blocked autoplay — wait for first user click anywhere
    document.addEventListener('click', function autoplayOnClick() {
      if (!musicIsPlaying) {
        audio.play().then(() => {
          musicIsPlaying = true;
          toggleBtn.textContent = '⏸';
          toggleBtn.classList.add('playing');
        });
      }
      document.removeEventListener('click', autoplayOnClick);
    }, { once: true });
  });

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (musicIsPlaying) {
      audio.pause();
      musicIsPlaying = false;
      toggleBtn.textContent = '▶';
      toggleBtn.classList.remove('playing');
    } else {
      if (!audio.src || audio.src === window.location.href) {
        loadTrack(musicCurrentIndex);
      }
      audio.play();
      musicIsPlaying = true;
      toggleBtn.textContent = '⏸';
      toggleBtn.classList.add('playing');
    }
  });

  nextBtn.addEventListener('click', () => {
    musicCurrentIndex = (musicCurrentIndex + 1) % MUSIC_PLAYLIST.length;
    loadTrack(musicCurrentIndex);
    if (musicIsPlaying) audio.play();
  });

  prevBtn.addEventListener('click', () => {
    musicCurrentIndex = (musicCurrentIndex - 1 + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length;
    loadTrack(musicCurrentIndex);
    if (musicIsPlaying) audio.play();
  });

  volumeSlider.addEventListener('input', () => {
    audio.volume = volumeSlider.value / 100;
    localStorage.setItem('music-volume', volumeSlider.value);
  });

  audio.addEventListener('ended', () => {
    musicCurrentIndex = (musicCurrentIndex + 1) % MUSIC_PLAYLIST.length;
    loadTrack(musicCurrentIndex);
    audio.play();
  });
}

function loadTrack(index) {
  const audio = document.getElementById('music-audio');
  const track = MUSIC_PLAYLIST[index];
  audio.src = MUSIC_BASE_URL + encodeURIComponent(track.file);
  localStorage.setItem('music-track', index);
  updateTrackDisplay();
}

function updateTrackDisplay() {
  const trackName = document.getElementById('music-track-name');
  if (trackName) {
    trackName.textContent = MUSIC_PLAYLIST[musicCurrentIndex].title;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initMusicPlayer();
});
