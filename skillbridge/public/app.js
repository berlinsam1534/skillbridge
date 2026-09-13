const state = {
  view: 'home',
  token: localStorage.getItem('sb_token') || null,
  user: null,
  theme: localStorage.getItem('sb_theme') || 'dark',

  jobs: [], courses: [],
  jobFilter: { kind: 'All', category: 'All', q: '' }, jobSort: 'newest',
  courseFilter: { category: 'All', level: 'All', q: '' },

  currentJobId: null, currentJob: null,
  currentCourseId: null, currentCourse: null, courseLessons: [], courseReviews: [], enrollment: null,
  activeLessonId: null, ratingHover: 0,

  favorites: [],
  dashboard: null,

  authOpen: false, authMode: 'login', authError: '', authBusy: false,
  authForm: { name: '', email: '', password: '', role: 'seeker', headline: '' },

  createOpen: false, createType: 'job', createError: '', createBusy: false,
  createForm: { title: '', company: '', location: 'Remote', job_type: 'Full-time', category: 'General',
    salary: '', description: '', tags: '', duration: '', stipend: '',
    level: 'Beginner', price: 'Free', cover_url: '', lessons: [{ title: '', content: '', video_url: '' }] },

  applyOpen: null, applyError: '', applyBusy: false,
  applyForm: { cover_note: '', resume_url: '' },

  applicantsOpen: null, applicantsList: [],
};

// ---------- tiny DOM helper ----------
function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (attrs[k] === undefined || attrs[k] === null) continue;
    if (k === 'class') e.className = attrs[k];
    else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k === 'checked') { if (attrs[k]) e.setAttribute('checked', 'checked'); }
    else e.setAttribute(k, attrs[k]);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c === null || c === undefined) return;
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(c) : c);
  });
  return e;
}

function toast(msg) {
  const root = document.getElementById('toast-root');
  root.innerHTML = '';
  const t = el('div', { class: 'toast' }, msg);
  root.appendChild(t);
  setTimeout(() => { if (root.contains(t)) root.removeChild(t); }, 3200);
}

// ---------- API helper ----------
async function api(path, opts = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch('/api' + path, Object.assign({}, opts, { headers }));
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) throw new Error((data && data.error) || 'Request failed');
  return data;
}

// ---------- init ----------
async function init() {
  applyTheme();
  if (state.token) {
    try {
      const r = await api('/auth/me');
      state.user = r.user;
    } catch (e) { state.token = null; localStorage.removeItem('sb_token'); }
  }
  render();
  await Promise.all([loadJobs(), loadCourses()]);
  if (state.user) loadDashboard();
}

function applyTheme() { document.body.className = state.theme === 'light' ? 'light' : 'dark'; }
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('sb_theme', state.theme);
  applyTheme(); render();
}

async function loadJobs() {
  try {
    const r = await api('/jobs');
    state.jobs = r.jobs;
    render();
  } catch (e) { /* ignore */ }
}

async function loadCourses() {
  try {
    const r = await api('/courses');
    state.courses = r.courses;
    render();
  } catch (e) { /* ignore */ }
}

async function loadDashboard() {
  try {
    const r = await api('/dashboard');
    state.dashboard = r;
    state.favorites = r.favorites || [];
    render();
  } catch (e) { /* ignore */ }
}

function goTo(view) { state.view = view; render(); window.scrollTo(0, 0); }

function isFavorited(type, id) {
  return state.favorites.some(f => f.item_type === type && f.item_id === id);
}
async function toggleFavorite(type, id, ev) {
  if (ev) ev.stopPropagation();
  if (!requireLogin()) return;
  try {
    const r = await api('/dashboard/favorites', { method: 'POST', body: JSON.stringify({ item_type: type, item_id: id }) });
    state.favorites = r.favorites;
    render();
  } catch (e) { toast(e.message); }
}

function requireLogin() {
  if (!state.user) { toast('Please log in first.'); openAuth('login'); return false; }
  return true;
}

// ---------- icons ----------
function icon(name) {
  const paths = {
    home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9"/>',
    jobs: '<rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
    courses: '<path d="M4 5h9a3 3 0 0 1 3 3v12a2.5 2.5 0 0 0-2.5-2.5H4z"/><path d="M20 5h-9a3 3 0 0 0-3 3v12a2.5 2.5 0 0 1 2.5-2.5H20z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4.5 5-6.5 8-6.5s6.5 2 8 6.5"/>',
    internship: '<path d="M12 2 4 6l8 4 8-4-8-4Z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/>',
  };
  return '<svg viewBox="0 0 24 24">' + paths[name] + '</svg>';
}

// ---------- root render ----------
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(renderTopbar());
  if (state.view === 'home') app.appendChild(renderHome());
  if (state.view === 'jobs') app.appendChild(renderJobs());
  if (state.view === 'jobdetail') app.appendChild(renderJobDetail());
  if (state.view === 'courses') app.appendChild(renderCourses());
  if (state.view === 'coursedetail') app.appendChild(renderCourseDetail());
  if (state.view === 'profile') app.appendChild(renderProfile());
  app.appendChild(renderBottomNav());
  if (state.authOpen) app.appendChild(renderAuthModal());
  if (state.createOpen) app.appendChild(renderCreateModal());
  if (state.applyOpen) app.appendChild(renderApplyModal());
  if (state.applicantsOpen) app.appendChild(renderApplicantsModal());
}

// ---------- topbar ----------
function renderTopbar() {
  const header = el('header', { class: 'topbar' });
  const row = el('div', { class: 'bar-row' });
  const logo = el('div', { class: 'logo', onclick: () => goTo('home') }, [
    el('span', { class: 'mark display' }, '▲'),
    el('span', { class: 'word display' }, 'SKILLBRIDGE'),
    el('span', { class: 'dot display' }, '.'),
  ]);
  row.appendChild(logo);

  if (state.view === 'jobs') {
    const wrap = el('div', { class: 'search-wrap' });
    wrap.appendChild(el('input', {
      type: 'text', placeholder: 'Search job or internship titles, companies…', value: state.jobFilter.q,
      oninput: (e) => { state.jobFilter.q = e.target.value; render(); loadJobs(); }
    }));
    row.appendChild(wrap);
  } else if (state.view === 'courses') {
    const wrap = el('div', { class: 'search-wrap' });
    wrap.appendChild(el('input', {
      type: 'text', placeholder: 'Search courses…', value: state.courseFilter.q,
      oninput: (e) => { state.courseFilter.q = e.target.value; render(); loadCourses(); }
    }));
    row.appendChild(wrap);
  } else {
    row.appendChild(el('div', { style: 'flex:1' }));
  }

  if (!state.user) {
    row.appendChild(el('button', { class: 'btn primary small', onclick: () => openAuth('login') }, 'Log in'));
  }
  row.appendChild(el('button', { class: 'icon-btn', title: 'Toggle theme', onclick: toggleTheme }, state.theme === 'dark' ? '☀' : '☾'));
  header.appendChild(row);

  if (state.view === 'jobs') {
    const chips = el('div', { class: 'chips' });
    [['All', 'All'], ['job', 'Jobs'], ['internship', 'Internships']].forEach(([v, label]) => {
      chips.appendChild(el('span', {
        class: 'chip' + (state.jobFilter.kind === v ? ' active' : ''),
        onclick: () => { state.jobFilter.kind = v; render(); loadJobs(); }
      }, label));
    });
    header.appendChild(chips);
    const cats = ['All', ...Array.from(new Set(state.jobs.map(j => j.category).filter(Boolean)))];
    const catChips = el('div', { class: 'chips' });
    cats.forEach(cat => {
      catChips.appendChild(el('span', {
        class: 'chip' + (state.jobFilter.category === cat ? ' active' : ''),
        onclick: () => { state.jobFilter.category = cat; render(); loadJobs(); }
      }, cat));
    });
    header.appendChild(catChips);
  }

  if (state.view === 'courses') {
    const cats = ['All', ...Array.from(new Set(state.courses.map(c => c.category).filter(Boolean)))];
    const chips = el('div', { class: 'chips' });
    cats.forEach(cat => {
      chips.appendChild(el('span', {
        class: 'chip' + (state.courseFilter.category === cat ? ' active' : ''),
        onclick: () => { state.courseFilter.category = cat; render(); loadCourses(); }
      }, cat));
    });
    header.appendChild(chips);
  }

  return header;
}

function jobsQuery() {
  const p = new URLSearchParams();
  if (state.jobFilter.kind !== 'All') p.set('kind', state.jobFilter.kind);
  if (state.jobFilter.category !== 'All') p.set('category', state.jobFilter.category);
  if (state.jobFilter.q) p.set('q', state.jobFilter.q);
  return p.toString();
}

// override loadJobs/loadCourses to include filters
async function loadJobs() {
  try {
    const r = await api('/jobs?' + jobsQuery());
    state.jobs = r.jobs;
    render();
  } catch (e) { /* ignore */ }
}
async function loadCourses() {
  const p = new URLSearchParams();
  if (state.courseFilter.category !== 'All') p.set('category', state.courseFilter.category);
  if (state.courseFilter.q) p.set('q', state.courseFilter.q);
  try {
    const r = await api('/courses?' + p.toString());
    state.courses = r.courses;
    render();
  } catch (e) { /* ignore */ }
}

// ---------- bottom nav ----------
function renderBottomNav() {
  const nav = el('nav', { class: 'bottom-nav' });
  const homeItem = el('button', { class: 'nav-item' + (state.view === 'home' ? ' active' : ''), onclick: () => goTo('home') });
  homeItem.innerHTML = icon('home'); homeItem.appendChild(el('span', {}, 'Home'));
  nav.appendChild(homeItem);

  const jobsItem = el('button', { class: 'nav-item' + (state.view === 'jobs' ? ' active' : ''), onclick: () => goTo('jobs') });
  jobsItem.innerHTML = icon('jobs'); jobsItem.appendChild(el('span', {}, 'Jobs'));
  nav.appendChild(jobsItem);

  const canPost = state.user && (state.user.role === 'employer' || state.user.role === 'instructor');
  const plusItem = el('button', { class: 'nav-item plus', onclick: () => openCreate() });
  plusItem.appendChild(el('div', { class: 'nav-plus-circle' }, '+'));
  plusItem.appendChild(el('span', {}, canPost ? 'Post' : 'Post'));
  nav.appendChild(plusItem);

  const coursesItem = el('button', { class: 'nav-item' + (state.view === 'courses' ? ' active' : ''), onclick: () => goTo('courses') });
  coursesItem.innerHTML = icon('courses'); coursesItem.appendChild(el('span', {}, 'Courses'));
  nav.appendChild(coursesItem);

  const youItem = el('button', { class: 'nav-item' + (state.view === 'profile' ? ' active' : ''), onclick: () => state.user ? goTo('profile') : openAuth('login') });
  const badgeWrap = el('span', { class: 'nav-badge' }); badgeWrap.innerHTML = icon('user');
  if (state.favorites.length) badgeWrap.appendChild(el('span', { class: 'count' }, String(state.favorites.length)));
  youItem.appendChild(badgeWrap); youItem.appendChild(el('span', {}, 'You'));
  nav.appendChild(youItem);

  return nav;
}

function openCreate() {
  if (!state.user) { toast('Log in as an employer or instructor to post.'); openAuth('login'); return; }
  if (state.user.role === 'seeker') { toast('Switch to an employer or instructor account to post listings.'); return; }
  state.createType = state.user.role === 'instructor' ? 'course' : 'job';
  state.createError = '';
  state.createOpen = true;
  render();
}

// ---------- HOME ----------
function renderHome() {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'landing-hero' }, [
    el('h1', { class: 'display' }, 'One platform.\nJobs, internships, and skills that grow with you.'),
    el('p', {}, 'Find your next role, land an internship, or level up with hands-on courses — all in one place.'),
  ]));

  if (!state.user) {
    const tabs = el('div', { class: 'role-tabs' });
    [['seeker', 'I\u2019m job hunting'], ['employer', 'I\u2019m hiring'], ['instructor', 'I teach']].forEach(([r, label]) => {
      tabs.appendChild(el('div', { class: 'role-tab', onclick: () => openAuth('register', r) }, label));
    });
    wrap.appendChild(tabs);
  }

  wrap.appendChild(el('div', { class: 'section-title' }, [
    el('span', {}, 'Latest openings'),
    el('a', { class: 'back-link', onclick: () => goTo('jobs') }, 'See all →'),
  ]));
  wrap.appendChild(renderJobGrid(state.jobs.slice(0, 4)));

  wrap.appendChild(el('div', { class: 'section-title' }, [
    el('span', {}, 'Popular courses'),
    el('a', { class: 'back-link', onclick: () => goTo('courses') }, 'See all →'),
  ]));
  wrap.appendChild(renderCourseGrid(state.courses.slice(0, 4)));

  return wrap;
}

// ---------- JOBS list ----------
function renderJobs() {
  const wrap = el('div');
  const sortRow = el('div', { class: 'sort-row' });
  sortRow.appendChild(el('span', {}, state.jobs.length + ' listing' + (state.jobs.length === 1 ? '' : 's')));
  sortRow.appendChild(el('span', { class: 'hint' }, state.jobFilter.kind === 'internship' ? 'Showing internships' : state.jobFilter.kind === 'job' ? 'Showing jobs' : ''));
  wrap.appendChild(sortRow);
  wrap.appendChild(renderJobGrid(state.jobs));
  return wrap;
}

function renderJobGrid(jobs) {
  if (!jobs.length) return el('div', { class: 'empty-state' }, [
    el('div', { class: 'display' }, 'No listings yet'),
    el('div', {}, 'Check back soon, or post one yourself.'),
  ]);
  const grid = el('div', { class: 'grid' });
  jobs.forEach(j => {
    const card = el('div', { class: 'card', onclick: () => openJob(j.id) });
    card.appendChild(el('div', { class: 'fav', onclick: (e) => toggleFavorite('job', j.id, e) }, isFavorited('job', j.id) ? '★' : '☆'));
    card.appendChild(el('span', { class: 'cat-tag' + (j.is_internship ? ' internship' : '') }, j.is_internship ? 'Internship' : j.job_type));
    card.appendChild(el('div', { class: 'card-title' }, j.title));
    card.appendChild(el('div', { class: 'card-meta' }, j.company + ' · ' + j.location));
    if (j.salary || j.stipend) card.appendChild(el('div', { class: 'card-meta' }, j.is_internship ? (j.stipend || 'Unpaid') : j.salary));
    if (j.tags && j.tags.length) {
      const tagsRow = el('div', { class: 'tags-mini' });
      j.tags.slice(0, 3).forEach(t => tagsRow.appendChild(el('span', { class: 'tag-pill-mini' }, t)));
      card.appendChild(tagsRow);
    }
    grid.appendChild(card);
  });
  return grid;
}

async function openJob(id) {
  state.currentJobId = id;
  state.currentJob = null;
  state.view = 'jobdetail';
  render();
  try {
    const r = await api('/jobs/' + id);
    state.currentJob = r.job;
    render();
  } catch (e) { toast(e.message); }
}

function renderJobDetail() {
  const wrap = el('div');
  wrap.appendChild(el('div', { style: 'padding-top:16px;' }, el('a', { class: 'back-link', onclick: () => goTo('jobs') }, '← Back to listings')));
  if (!state.currentJob) { wrap.appendChild(el('div', { class: 'hint', style: 'padding:20px 0;' }, 'Loading…')); return wrap; }
  const j = state.currentJob;
  const head = el('div', { class: 'detail-head' });
  head.appendChild(el('span', { class: 'cat-tag' + (j.is_internship ? ' internship' : '') }, j.is_internship ? 'Internship' : j.job_type));
  head.appendChild(el('h1', {}, j.title));
  head.appendChild(el('div', { class: 'detail-meta' }, j.company + ' · ' + j.location + (j.is_internship ? (j.duration ? ' · ' + j.duration : '') : '')));
  wrap.appendChild(head);

  wrap.appendChild(el('div', { class: 'detail-desc' }, j.description || 'No description provided.'));
  if (j.tags && j.tags.length) {
    const tagRow = el('div', { class: 'tag-row' });
    j.tags.forEach(t => tagRow.appendChild(el('span', { class: 'tag-pill' }, t)));
    wrap.appendChild(tagRow);
  }

  const actions = el('div', { class: 'detail-actions' });
  const isOwner = state.user && state.user.id === j.employer_id;
  if (isOwner) {
    actions.appendChild(el('button', { class: 'btn primary', onclick: () => openApplicants(j.id) }, 'View applicants (' + j.applicantCount + ')'));
    actions.appendChild(el('button', { class: 'btn', onclick: () => deleteJob(j.id) }, 'Delete listing'));
  } else if (state.user && state.user.role === 'seeker') {
    actions.appendChild(el('button', { class: 'btn primary', onclick: () => openApply(j.id) }, j.is_internship ? 'Apply for internship' : 'Apply now'));
  } else if (!state.user) {
    actions.appendChild(el('button', { class: 'btn primary', onclick: () => openAuth('login') }, 'Log in to apply'));
  }
  actions.appendChild(el('button', { class: 'btn', onclick: (e) => toggleFavorite('job', j.id, e) }, isFavorited('job', j.id) ? '★ Saved' : '☆ Save'));
  wrap.appendChild(actions);
  wrap.appendChild(el('div', { class: 'hint' }, (j.salary ? 'Salary: ' + j.salary : '') + (j.stipend ? '  Stipend: ' + j.stipend : '')));

  return wrap;
}

async function deleteJob(id) {
  if (!confirm('Delete this listing? This cannot be undone.')) return;
  try {
    await api('/jobs/' + id, { method: 'DELETE' });
    toast('Listing deleted.');
    goTo('jobs'); loadJobs();
  } catch (e) { toast(e.message); }
}

function openApply(jobId) {
  state.applyOpen = jobId;
  state.applyError = '';
  state.applyForm = { cover_note: '', resume_url: '' };
  render();
}
function renderApplyModal() {
  const overlay = el('div', { class: 'overlay', onclick: (e) => { if (e.target === e.currentTarget) { state.applyOpen = null; render(); } } });
  const modal = el('div', { class: 'modal' });
  modal.appendChild(el('h2', {}, 'Apply now'));
  const noteField = el('div', { class: 'field' }, [
    el('label', {}, 'Cover note'),
    el('textarea', { placeholder: 'Why are you a great fit for this role?', oninput: e => state.applyForm.cover_note = e.target.value }, state.applyForm.cover_note),
  ]);
  const resumeField = el('div', { class: 'field' }, [
    el('label', {}, 'Resume / portfolio link'),
    el('input', { type: 'text', placeholder: 'https://…', value: state.applyForm.resume_url, oninput: e => state.applyForm.resume_url = e.target.value }),
  ]);
  modal.appendChild(noteField); modal.appendChild(resumeField);
  if (state.applyError) modal.appendChild(el('div', { class: 'err-msg' }, state.applyError));
  const actions = el('div', { class: 'modal-actions' });
  actions.appendChild(el('button', { class: 'btn', onclick: () => { state.applyOpen = null; render(); } }, 'Cancel'));
  actions.appendChild(el('button', { class: 'btn primary', onclick: submitApplication }, state.applyBusy ? 'Submitting…' : 'Submit application'));
  modal.appendChild(actions);
  overlay.appendChild(modal);
  return overlay;
}
async function submitApplication() {
  state.applyBusy = true; state.applyError = ''; render();
  try {
    await api('/jobs/' + state.applyOpen + '/apply', { method: 'POST', body: JSON.stringify(state.applyForm) });
    state.applyOpen = null;
    toast('Application submitted!');
    loadDashboard();
  } catch (e) { state.applyError = e.message; }
  state.applyBusy = false; render();
}

function openApplicants(jobId) {
  state.applicantsOpen = jobId;
  state.applicantsList = [];
  render();
  api('/jobs/' + jobId + '/applications').then(r => { state.applicantsList = r.applications; render(); }).catch(e => toast(e.message));
}
function renderApplicantsModal() {
  const overlay = el('div', { class: 'overlay', onclick: (e) => { if (e.target === e.currentTarget) { state.applicantsOpen = null; render(); } } });
  const modal = el('div', { class: 'modal', style: 'max-width:640px;' });
  modal.appendChild(el('h2', {}, 'Applicants'));
  if (!state.applicantsList.length) modal.appendChild(el('div', { class: 'hint' }, 'No applications yet.'));
  state.applicantsList.forEach(a => {
    const row = el('div', { class: 'list-row' });
    const main = el('div', { class: 'lr-main' }, [
      el('div', { class: 'lr-title' }, a.applicant_name + ' — ' + a.applicant_email),
      el('div', { class: 'lr-sub' }, a.applicant_headline || ''),
      el('div', { class: 'lr-sub' }, a.cover_note || ''),
      a.resume_url ? el('a', { class: 'back-link', href: a.resume_url, target: '_blank' }, 'View resume/portfolio ↗') : null,
    ]);
    row.appendChild(main);
    const sel = el('select', { onchange: e => updateApplicationStatus(a.id, e.target.value) });
    ['submitted', 'reviewed', 'shortlisted', 'hired', 'rejected'].forEach(s => {
      const o = el('option', { value: s }, s[0].toUpperCase() + s.slice(1));
      if (a.status === s) o.setAttribute('selected', 'selected');
      sel.appendChild(o);
    });
    row.appendChild(sel);
    modal.appendChild(row);
  });
  const actions = el('div', { class: 'modal-actions' });
  actions.appendChild(el('button', { class: 'btn', onclick: () => { state.applicantsOpen = null; render(); } }, 'Close'));
  modal.appendChild(actions);
  overlay.appendChild(modal);
  return overlay;
}
async function updateApplicationStatus(appId, status) {
  try {
    await api('/jobs/applications/' + appId + '/status', { method: 'PATCH', body: JSON.stringify({ status }) });
    toast('Status updated.');
  } catch (e) { toast(e.message); }
}

// ---------- COURSES list ----------
function renderCourses() {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'sort-row' }, el('span', {}, state.courses.length + ' course' + (state.courses.length === 1 ? '' : 's'))));
  wrap.appendChild(renderCourseGrid(state.courses));
  return wrap;
}
function renderCourseGrid(courses) {
  if (!courses.length) return el('div', { class: 'empty-state' }, [
    el('div', { class: 'display' }, 'No courses yet'),
    el('div', {}, 'Instructors can post the first one.'),
  ]);
  const grid = el('div', { class: 'grid' });
  courses.forEach(c => {
    const card = el('div', { class: 'card', onclick: () => openCourse(c.id) });
    card.appendChild(el('div', { class: 'fav', onclick: (e) => toggleFavorite('course', c.id, e) }, isFavorited('course', c.id) ? '★' : '☆'));
    card.appendChild(el('span', { class: 'cat-tag course' }, c.category));
    card.appendChild(el('div', { class: 'card-title' }, c.title));
    card.appendChild(el('div', { class: 'card-meta' }, c.level + ' · ' + c.lessonCount + ' lessons · ' + c.price));
    if (c.reviewCount) card.appendChild(el('div', { class: 'stars-mini' }, starsString(c.avgRating) + ' (' + c.reviewCount + ')'));
    grid.appendChild(card);
  });
  return grid;
}
function starsString(avg) { const full = Math.round(avg); return '★'.repeat(full) + '☆'.repeat(5 - full); }

async function openCourse(id) {
  state.currentCourseId = id;
  state.currentCourse = null;
  state.view = 'coursedetail';
  render();
  try {
    const r = await api('/courses/' + id);
    state.currentCourse = r.course;
    state.courseLessons = r.lessons;
    state.courseReviews = r.reviews;
    state.enrollment = r.enrollment;
    state.activeLessonId = r.lessons.length ? r.lessons[0].id : null;
    render();
  } catch (e) { toast(e.message); }
}

function renderCourseDetail() {
  const wrap = el('div');
  wrap.appendChild(el('div', { style: 'padding-top:16px;' }, el('a', { class: 'back-link', onclick: () => goTo('courses') }, '← Back to courses')));
  if (!state.currentCourse) { wrap.appendChild(el('div', { class: 'hint', style: 'padding:20px 0;' }, 'Loading…')); return wrap; }
  const c = state.currentCourse;
  const head = el('div', { class: 'detail-head' });
  head.appendChild(el('span', { class: 'cat-tag course' }, c.category));
  head.appendChild(el('h1', {}, c.title));
  head.appendChild(el('div', { class: 'detail-meta' }, c.level + ' · ' + c.lessonCount + ' lessons · ' + c.enrolledCount + ' enrolled · ' + c.price));
  if (c.reviewCount) head.appendChild(el('div', { class: 'stars-mini' }, starsString(c.avgRating) + ' ' + c.avgRating.toFixed(1) + ' (' + c.reviewCount + ' reviews)'));
  wrap.appendChild(head);
  wrap.appendChild(el('div', { class: 'detail-desc' }, c.description || 'No description provided.'));

  const actions = el('div', { class: 'detail-actions' });
  const isOwner = state.user && state.user.id === c.instructor_id;
  if (!isOwner) {
    if (!state.enrollment) {
      actions.appendChild(el('button', { class: 'btn primary', onclick: enrollCourse }, 'Enroll'));
    } else {
      actions.appendChild(el('span', { class: 'role-badge' }, 'Enrolled'));
    }
  }
  actions.appendChild(el('button', { class: 'btn', onclick: (e) => toggleFavorite('course', c.id, e) }, isFavorited('course', c.id) ? '★ Saved' : '☆ Save'));
  wrap.appendChild(actions);

  if (state.enrollment) {
    const done = state.enrollment.completed_lessons || [];
    const pct = state.courseLessons.length ? Math.round((done.length / state.courseLessons.length) * 100) : 0;
    const bar = el('div', { class: 'card progress-bar-outer', style: 'max-width:400px;' });
    bar.appendChild(el('div', { class: 'progress-bar', style: 'width:' + pct + '%;' }));
    wrap.appendChild(el('div', { class: 'hint' }, pct + '% complete'));
    wrap.appendChild(bar);
  }

  wrap.appendChild(el('div', { class: 'section-title' }, [
    el('span', {}, 'Lessons'),
    el('span', { class: 'box-count' }, state.courseLessons.length + ' total'),
  ]));
  const lessonBox = el('div', { class: 'box lesson-list' });
  const done = state.enrollment ? (state.enrollment.completed_lessons || []) : [];
  state.courseLessons.forEach(l => {
    const isDone = done.includes(l.id);
    const item = el('div', {
      class: 'lesson-item' + (state.activeLessonId === l.id ? ' current' : '') + (isDone ? ' done' : ''),
      onclick: () => { state.activeLessonId = l.id; render(); }
    });
    item.appendChild(el('span', { class: 'lesson-num display' }, String(l.number)));
    item.appendChild(el('span', { class: 'ltitle' }, l.title));
    if (state.enrollment) {
      item.appendChild(el('span', {
        class: 'lesson-check', onclick: (e) => { e.stopPropagation(); toggleLessonDone(l.id, !isDone); }
      }, isDone ? '✅' : '⬜'));
    }
    lessonBox.appendChild(item);
  });
  if (!state.courseLessons.length) lessonBox.appendChild(el('div', { class: 'hint' }, 'No lessons added yet.'));
  wrap.appendChild(lessonBox);

  const activeLesson = state.courseLessons.find(l => l.id === state.activeLessonId);
  if (activeLesson) {
    const stage = el('div', { class: 'box', style: 'margin-top:14px;' });
    stage.appendChild(el('h3', { class: 'display', style: 'margin:0 0 10px; font-size:18px;' }, activeLesson.title));
    if (activeLesson.video_url) stage.appendChild(el('div', { class: 'hint' }, el('a', { class: 'back-link', href: activeLesson.video_url, target: '_blank' }, 'Watch video ↗')));
    stage.appendChild(el('div', { class: 'detail-desc' }, activeLesson.content || 'No content yet.'));
    wrap.appendChild(stage);
  }

  if (isOwner) {
    wrap.appendChild(el('button', { class: 'btn', style: 'margin-top:14px;', onclick: () => addLessonPrompt(c.id) }, '+ Add lesson'));
  }

  wrap.appendChild(renderCourseSocial(c));
  return wrap;
}

async function enrollCourse() {
  if (!requireLogin()) return;
  if (state.user.role !== 'seeker') { toast('Enroll using a learner (seeker) account.'); return; }
  try {
    const r = await api('/courses/' + state.currentCourseId + '/enroll', { method: 'POST' });
    state.enrollment = r.enrollment;
    toast('Enrolled! Happy learning.');
    render(); loadDashboard();
  } catch (e) { toast(e.message); }
}
async function toggleLessonDone(lessonId, completed) {
  try {
    const r = await api('/courses/' + state.currentCourseId + '/progress', { method: 'POST', body: JSON.stringify({ lesson_id: lessonId, completed }) });
    state.enrollment.completed_lessons = r.completed_lessons;
    render(); loadDashboard();
  } catch (e) { toast(e.message); }
}
async function addLessonPrompt(courseId) {
  const title = prompt('Lesson title:');
  if (!title) return;
  const content = prompt('Lesson content (text):') || '';
  const video_url = prompt('Video URL (optional):') || '';
  try {
    await api('/courses/' + courseId + '/lessons', { method: 'POST', body: JSON.stringify({ title, content, video_url }) });
    toast('Lesson added.');
    openCourse(courseId);
  } catch (e) { toast(e.message); }
}

function renderCourseSocial(c) {
  const block = el('div', { class: 'social-block' });
  const ratingBox = el('div', { class: 'panel-box' });
  ratingBox.appendChild(el('h3', {}, 'Rate this course'));
  const starsRow = el('div', { class: 'stars-input' });
  const myReview = state.courseReviews.find(r => state.user && r.student_id === state.user.id);
  for (let i = 1; i <= 5; i++) {
    const filled = i <= (state.ratingHover || (myReview ? myReview.rating : 0));
    const s = el('span', { class: 'star' + (filled ? ' filled' : '') }, '★');
    s.addEventListener('mouseenter', () => { state.ratingHover = i; render(); });
    s.addEventListener('mouseleave', () => { state.ratingHover = 0; render(); });
    s.addEventListener('click', () => submitRating(c.id, i));
    starsRow.appendChild(s);
  }
  ratingBox.appendChild(starsRow);
  ratingBox.appendChild(el('div', { class: 'hint' }, c.reviewCount ? ('Average ' + c.avgRating.toFixed(1) + ' / 5 from ' + c.reviewCount + ' learner(s).') : 'No ratings yet — be the first.'));
  block.appendChild(ratingBox);

  const commentBox = el('div', { class: 'panel-box' });
  commentBox.appendChild(el('h3', {}, 'Reviews'));
  const list = el('div', {});
  state.courseReviews.forEach(r => {
    if (!r.comment) return;
    list.appendChild(el('div', { class: 'comment' }, [
      el('div', { class: 'cname' }, r.student_name),
      el('div', { class: 'ctext' }, r.comment),
      el('div', { class: 'ctime' }, new Date(r.created_at).toLocaleString()),
    ]));
  });
  if (!state.courseReviews.some(r => r.comment)) list.appendChild(el('div', { class: 'hint' }, 'No written reviews yet.'));
  commentBox.appendChild(list);

  if (state.enrollment) {
    const form = el('div', { class: 'comment-form' });
    const textInput = el('textarea', { placeholder: 'Share your thoughts on this course…' });
    const postBtn = el('button', { class: 'btn primary', style: 'margin-top:8px;', onclick: async () => {
      const text = textInput.value.trim();
      if (!text) return;
      await submitRating(c.id, myReview ? myReview.rating : 5, text);
      textInput.value = '';
    }}, 'Post review');
    form.appendChild(textInput); form.appendChild(postBtn);
    commentBox.appendChild(form);
  }
  block.appendChild(commentBox);
  return block;
}
async function submitRating(courseId, stars, comment) {
  if (!requireLogin()) return;
  if (state.user.role !== 'seeker') { toast('Only learners can rate courses.'); return; }
  try {
    await api('/courses/' + courseId + '/reviews', { method: 'POST', body: JSON.stringify({ rating: stars, comment: comment || '' }) });
    toast('Thanks for the feedback!');
    openCourse(courseId);
  } catch (e) { toast(e.message); }
}

// ---------- PROFILE / DASHBOARD ----------
function renderProfile() {
  const wrap = el('div');
  if (!state.user) {
    wrap.appendChild(el('div', { class: 'empty-state' }, [
      el('div', { class: 'display' }, 'Not logged in'),
      el('button', { class: 'btn primary', style: 'margin-top:12px;', onclick: () => openAuth('login') }, 'Log in'),
    ]));
    return wrap;
  }
  const u = state.user;
  const card = el('div', { class: 'profile-card' });
  card.appendChild(el('div', { class: 'profile-avatar display' }, u.name.slice(0, 1).toUpperCase()));
  card.appendChild(el('div', { class: 'display', style: 'font-size:20px;' }, u.name));
  card.appendChild(el('div', { class: 'hint' }, u.email));
  card.appendChild(el('div', { style: 'margin-top:8px;' }, el('span', { class: 'role-badge' }, u.role)));
  if (u.headline) card.appendChild(el('div', { style: 'margin-top:10px; font-size:13px; opacity:.8;' }, u.headline));
  card.appendChild(el('button', { class: 'btn small', style: 'margin-top:14px;', onclick: logout }, 'Log out'));
  wrap.appendChild(card);

  const d = state.dashboard || {};

  if (u.role === 'seeker') {
    wrap.appendChild(el('div', { class: 'section-title' }, 'My applications'));
    const apps = d.myApplications || [];
    if (!apps.length) wrap.appendChild(el('div', { class: 'hint' }, 'You haven\u2019t applied to anything yet.'));
    apps.forEach(a => {
      wrap.appendChild(el('div', { class: 'list-row' }, [
        el('div', { class: 'lr-main' }, [
          el('div', { class: 'lr-title' }, a.title + ' — ' + a.company),
          el('div', { class: 'lr-sub' }, a.is_internship ? 'Internship' : 'Job'),
        ]),
        el('span', { class: 'status-pill status-' + a.status }, a.status),
      ]));
    });

    wrap.appendChild(el('div', { class: 'section-title' }, 'My courses'));
    const enrolls = d.myEnrollments || [];
    if (!enrolls.length) wrap.appendChild(el('div', { class: 'hint' }, 'You haven\u2019t enrolled in any course yet.'));
    enrolls.forEach(e => {
      wrap.appendChild(el('div', { class: 'list-row', onclick: () => openCourse(e.course_id) }, [
        el('div', { class: 'lr-main' }, [
          el('div', { class: 'lr-title' }, e.title),
          el('div', { class: 'lr-sub' }, e.category),
        ]),
        el('span', { class: 'hint' }, e.completed_lessons.length + ' lessons done'),
      ]));
    });
  }

  if (u.role === 'employer') {
    wrap.appendChild(el('div', { class: 'section-title' }, 'My listings'));
    const listings = d.myListings || [];
    if (!listings.length) wrap.appendChild(el('div', { class: 'hint' }, 'You haven\u2019t posted anything yet. Tap + to post a job or internship.'));
    listings.forEach(j => {
      wrap.appendChild(el('div', { class: 'list-row' }, [
        el('div', { class: 'lr-main', onclick: () => openJob(j.id) }, [
          el('div', { class: 'lr-title' }, j.title + (j.is_internship ? ' (Internship)' : '')),
          el('div', { class: 'lr-sub' }, j.applicantCount + ' applicant(s)'),
        ]),
        el('button', { class: 'btn small', onclick: () => openApplicants(j.id) }, 'View'),
      ]));
    });
  }

  if (u.role === 'instructor') {
    wrap.appendChild(el('div', { class: 'section-title' }, 'My courses'));
    const courses = d.myCourses || [];
    if (!courses.length) wrap.appendChild(el('div', { class: 'hint' }, 'You haven\u2019t created a course yet. Tap + to create one.'));
    courses.forEach(c => {
      wrap.appendChild(el('div', { class: 'list-row', onclick: () => openCourse(c.id) }, [
        el('div', { class: 'lr-main' }, [
          el('div', { class: 'lr-title' }, c.title),
          el('div', { class: 'lr-sub' }, c.enrolledCount + ' enrolled'),
        ]),
      ]));
    });
  }

  return wrap;
}

function logout() {
  state.token = null; state.user = null; state.dashboard = null; state.favorites = [];
  localStorage.removeItem('sb_token');
  goTo('home');
}

// ---------- AUTH modal ----------
function openAuth(mode, presetRole) {
  state.authOpen = true; state.authMode = mode; state.authError = '';
  state.authForm = { name: '', email: '', password: '', role: presetRole || 'seeker', headline: '' };
  render();
}
function renderAuthModal() {
  const overlay = el('div', { class: 'overlay', onclick: (e) => { if (e.target === e.currentTarget) { state.authOpen = false; render(); } } });
  const modal = el('div', { class: 'modal' });
  modal.appendChild(el('h2', {}, state.authMode === 'login' ? 'Log in' : 'Create your account'));

  if (state.authMode === 'register') {
    modal.appendChild(el('div', { class: 'field' }, [
      el('label', {}, 'I am a…'),
      (() => {
        const sel = el('select', { onchange: e => state.authForm.role = e.target.value });
        [['seeker', 'Job / internship seeker'], ['employer', 'Employer / recruiter'], ['instructor', 'Instructor']].forEach(([v, l]) => {
          const o = el('option', { value: v }, l);
          if (state.authForm.role === v) o.setAttribute('selected', 'selected');
          sel.appendChild(o);
        });
        return sel;
      })(),
    ]));
    modal.appendChild(el('div', { class: 'field' }, [
      el('label', {}, 'Full name'),
      el('input', { type: 'text', value: state.authForm.name, oninput: e => state.authForm.name = e.target.value }),
    ]));
  }

  modal.appendChild(el('div', { class: 'field' }, [
    el('label', {}, 'Email'),
    el('input', { type: 'email', value: state.authForm.email, oninput: e => state.authForm.email = e.target.value }),
  ]));
  modal.appendChild(el('div', { class: 'field' }, [
    el('label', {}, 'Password'),
    el('input', { type: 'password', value: state.authForm.password, oninput: e => state.authForm.password = e.target.value }),
  ]));

  if (state.authError) modal.appendChild(el('div', { class: 'err-msg' }, state.authError));

  const actions = el('div', { class: 'modal-actions' });
  actions.appendChild(el('button', { class: 'btn', onclick: () => { state.authOpen = false; render(); } }, 'Cancel'));
  actions.appendChild(el('button', { class: 'btn primary', onclick: submitAuth }, state.authBusy ? 'Please wait…' : (state.authMode === 'login' ? 'Log in' : 'Sign up')));
  modal.appendChild(actions);

  const switchLine = el('div', { class: 'hint', style: 'margin-top:14px; text-align:center;' });
  if (state.authMode === 'login') {
    switchLine.appendChild(document.createTextNode('New here? '));
    switchLine.appendChild(el('a', { class: 'back-link', onclick: () => { state.authMode = 'register'; state.authError = ''; render(); } }, 'Create an account'));
  } else {
    switchLine.appendChild(document.createTextNode('Already have an account? '));
    switchLine.appendChild(el('a', { class: 'back-link', onclick: () => { state.authMode = 'login'; state.authError = ''; render(); } }, 'Log in'));
  }
  modal.appendChild(switchLine);

  overlay.appendChild(modal);
  return overlay;
}
async function submitAuth() {
  state.authBusy = true; state.authError = ''; render();
  try {
    const path = state.authMode === 'login' ? '/auth/login' : '/auth/register';
    const r = await api(path, { method: 'POST', body: JSON.stringify(state.authForm) });
    state.token = r.token; state.user = r.user;
    localStorage.setItem('sb_token', r.token);
    state.authOpen = false;
    toast('Welcome, ' + r.user.name + '!');
    loadDashboard();
  } catch (e) { state.authError = e.message; }
  state.authBusy = false; render();
}

// ---------- CREATE modal (post job/internship or course) ----------
function renderCreateModal() {
  const overlay = el('div', { class: 'overlay', onclick: (e) => { if (e.target === e.currentTarget) { state.createOpen = false; render(); } } });
  const modal = el('div', { class: 'modal', style: 'max-width:600px;' });
  const isInstructor = state.user.role === 'instructor';

  modal.appendChild(el('h2', {}, isInstructor ? 'Create a course' : (state.createType === 'internship' ? 'Post an internship' : 'Post a job')));

  if (!isInstructor) {
    const tabs = el('div', { class: 'chips', style: 'margin-bottom:14px;' });
    [['job', 'Job'], ['internship', 'Internship']].forEach(([v, l]) => {
      tabs.appendChild(el('span', { class: 'chip' + (state.createType === v ? ' active' : ''), onclick: () => { state.createType = v; render(); } }, l));
    });
    modal.appendChild(tabs);
  }

  const f = state.createForm;
  const field = (label, node) => el('div', { class: 'field' }, [el('label', {}, label), node]);

  if (isInstructor) {
    modal.appendChild(field('Title', el('input', { type: 'text', value: f.title, oninput: e => f.title = e.target.value })));
    const row1 = el('div', { class: 'field-row' });
    row1.appendChild(field('Category', el('input', { type: 'text', value: f.category, oninput: e => f.category = e.target.value })));
    row1.appendChild(field('Level', (() => {
      const sel = el('select', { onchange: e => f.level = e.target.value });
      ['Beginner', 'Intermediate', 'Advanced'].forEach(l => { const o = el('option', { value: l }, l); if (f.level === l) o.setAttribute('selected', 'selected'); sel.appendChild(o); });
      return sel;
    })()));
    modal.appendChild(row1);
    modal.appendChild(field('Price', el('input', { type: 'text', placeholder: 'Free or $49', value: f.price, oninput: e => f.price = e.target.value })));
    modal.appendChild(field('Cover image URL', el('input', { type: 'text', placeholder: 'https://…', value: f.cover_url, oninput: e => f.cover_url = e.target.value })));
    modal.appendChild(field('Description', el('textarea', { oninput: e => f.description = e.target.value }, f.description)));

    modal.appendChild(el('label', { style: 'display:block; font-size:12px; font-weight:700; margin:14px 0 8px; text-transform:uppercase; letter-spacing:.04em; opacity:.75;' }, 'Lessons'));
    f.lessons.forEach((l, idx) => {
      const row = el('div', { class: 'lesson-row' });
      row.appendChild(el('div', { class: 'field' }, [
        el('label', {}, 'Lesson ' + (idx + 1) + ' title'),
        el('input', { type: 'text', value: l.title, oninput: e => l.title = e.target.value }),
      ]));
      row.appendChild(el('button', { class: 'btn small', onclick: () => { f.lessons.splice(idx, 1); render(); } }, '✕'));
      modal.appendChild(row);
    });
    modal.appendChild(el('button', { class: 'btn small', onclick: () => { f.lessons.push({ title: '', content: '', video_url: '' }); render(); } }, '+ Add lesson'));
  } else {
    modal.appendChild(field('Title', el('input', { type: 'text', value: f.title, oninput: e => f.title = e.target.value })));
    modal.appendChild(field('Company', el('input', { type: 'text', value: f.company, oninput: e => f.company = e.target.value })));
    const row1 = el('div', { class: 'field-row' });
    row1.appendChild(field('Location', el('input', { type: 'text', value: f.location, oninput: e => f.location = e.target.value })));
    row1.appendChild(field('Category', el('input', { type: 'text', value: f.category, oninput: e => f.category = e.target.value })));
    modal.appendChild(row1);
    if (state.createType === 'internship') {
      const row2 = el('div', { class: 'field-row' });
      row2.appendChild(field('Duration', el('input', { type: 'text', placeholder: 'e.g. 3 months', value: f.duration, oninput: e => f.duration = e.target.value })));
      row2.appendChild(field('Stipend', el('input', { type: 'text', placeholder: 'e.g. $800/mo', value: f.stipend, oninput: e => f.stipend = e.target.value })));
      modal.appendChild(row2);
    } else {
      const row2 = el('div', { class: 'field-row' });
      row2.appendChild(field('Job type', (() => {
        const sel = el('select', { onchange: e => f.job_type = e.target.value });
        ['Full-time', 'Part-time', 'Contract'].forEach(l => { const o = el('option', { value: l }, l); if (f.job_type === l) o.setAttribute('selected', 'selected'); sel.appendChild(o); });
        return sel;
      })()));
      row2.appendChild(field('Salary', el('input', { type: 'text', placeholder: 'e.g. $90k–110k', value: f.salary, oninput: e => f.salary = e.target.value })));
      modal.appendChild(row2);
    }
    modal.appendChild(field('Tags (comma separated)', el('input', { type: 'text', placeholder: 'react, remote, senior', value: f.tags, oninput: e => f.tags = e.target.value })));
    modal.appendChild(field('Description', el('textarea', { oninput: e => f.description = e.target.value }, f.description)));
  }

  if (state.createError) modal.appendChild(el('div', { class: 'err-msg' }, state.createError));

  const actions = el('div', { class: 'modal-actions' });
  actions.appendChild(el('button', { class: 'btn', onclick: () => { state.createOpen = false; render(); } }, 'Cancel'));
  actions.appendChild(el('button', { class: 'btn primary', onclick: submitCreate }, state.createBusy ? 'Posting…' : 'Publish'));
  modal.appendChild(actions);

  overlay.appendChild(modal);
  return overlay;
}

async function submitCreate() {
  state.createBusy = true; state.createError = ''; render();
  const f = state.createForm;
  try {
    if (state.user.role === 'instructor') {
      if (!f.title.trim()) throw new Error('Title is required');
      await api('/courses', { method: 'POST', body: JSON.stringify({
        title: f.title, category: f.category, level: f.level, description: f.description,
        cover_url: f.cover_url, price: f.price, lessons: f.lessons.filter(l => l.title.trim()),
      })});
      toast('Course published!');
    } else {
      if (!f.title.trim() || !f.company.trim()) throw new Error('Title and company are required');
      await api('/jobs', { method: 'POST', body: JSON.stringify({
        title: f.title, company: f.company, location: f.location, job_type: f.job_type, category: f.category,
        salary: f.salary, description: f.description, tags: f.tags.split(',').map(t => t.trim()).filter(Boolean),
        is_internship: state.createType === 'internship', duration: f.duration, stipend: f.stipend,
      })});
      toast(state.createType === 'internship' ? 'Internship posted!' : 'Job posted!');
    }
    state.createOpen = false;
    state.createForm = { title: '', company: '', location: 'Remote', job_type: 'Full-time', category: 'General',
      salary: '', description: '', tags: '', duration: '', stipend: '',
      level: 'Beginner', price: 'Free', cover_url: '', lessons: [{ title: '', content: '', video_url: '' }] };
    loadJobs(); loadCourses(); loadDashboard();
  } catch (e) { state.createError = e.message; }
  state.createBusy = false; render();
}

init();
