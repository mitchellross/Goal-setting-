let goals = [
  {
    id: crypto.randomUUID(),
    title: "Run a 10k",
    category: "Health",
    deadline: "",
    milestones: [
      { id: crypto.randomUUID(), text: "Run a 5k without stopping", done: true },
      { id: crypto.randomUUID(), text: "Run 7k comfortably", done: false },
      { id: crypto.randomUUID(), text: "Complete the 10k", done: false }
    ]
  }
];

const trailEl = document.getElementById("trail");
const emptyStateEl = document.getElementById("emptyState");
const formOverlay = document.getElementById("formOverlay");
const goalForm = document.getElementById("goalForm");
const openFormBtn = document.getElementById("openFormBtn");
const cancelFormBtn = document.getElementById("cancelFormBtn");

const statTotal = document.getElementById("statTotal");
const statDone = document.getElementById("statDone");
const statAvg = document.getElementById("statAvg");

function progressOf(goal) {
  if (!goal.milestones.length) return 0;
  const done = goal.milestones.filter(m => m.done).length;
  return Math.round((done / goal.milestones.length) * 100);
}

function isComplete(goal) {
  return goal.milestones.length > 0 && goal.milestones.every(m => m.done);
}

function formatDeadline(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const opts = { month: "short", day: "numeric" };
  const label = d.toLocaleDateString(undefined, opts);
  const overdue = d < new Date(new Date().toDateString());
  return { label, overdue };
}

function render() {
  trailEl.innerHTML = "";

  if (goals.length === 0) {
    emptyStateEl.style.display = "block";
  } else {
    emptyStateEl.style.display = "none";
    goals.forEach(goal => trailEl.appendChild(renderGoalCard(goal)));
  }

  renderStats();
}

function renderStats() {
  const total = goals.length;
  const done = goals.filter(isComplete).length;
  const avg = total
    ? Math.round(goals.reduce((sum, g) => sum + progressOf(g), 0) / total)
    : 0;

  statTotal.textContent = total;
  statDone.textContent = done;
  statAvg.textContent = avg + "%";
}

function renderGoalCard(goal) {
  const pct = progressOf(goal);
  const complete = isComplete(goal);

  const card = document.createElement("article");
  card.className = "goal-card" + (complete ? " is-complete" : "");

  const deadlineInfo = formatDeadline(goal.deadline);

  card.innerHTML = `
    <div class="ring-wrap" style="--pct:${pct}">${pct}%</div>
    <div class="goal-body">
      <div class="goal-top">
        <h3 class="goal-title">${escapeHtml(goal.title)}</h3>
        <button class="icon-btn" data-action="delete" title="Remove goal">✕</button>
      </div>
      <div class="goal-meta">
        <span class="tag">${escapeHtml(goal.category)}</span>
        ${deadlineInfo ? `<span class="tag deadline ${deadlineInfo.overdue && !complete ? "overdue" : ""}">${deadlineInfo.overdue && !complete ? "Overdue · " : "By "}${deadlineInfo.label}</span>` : ""}
      </div>
      <ul class="milestones">
        ${goal.milestones.map(m => `
          <li class="milestone ${m.done ? "done" : ""}" data-milestone-id="${m.id}">
            <input type="checkbox" ${m.done ? "checked" : ""} data-action="toggle-milestone">
            <span>${escapeHtml(m.text)}</span>
          </li>
        `).join("")}
      </ul>
      <div class="add-milestone">
        <input type="text" placeholder="Add a milestone…" data-action="milestone-input">
        <button data-action="add-milestone">+</button>
      </div>
    </div>
  `;

  card.querySelector('[data-action="delete"]').addEventListener("click", () => {
    goals = goals.filter(g => g.id !== goal.id);
    render();
  });

  card.querySelectorAll('[data-action="toggle-milestone"]').forEach(cb => {
    cb.addEventListener("change", () => {
      const li = cb.closest("[data-milestone-id]");
      const milestone = goal.milestones.find(m => m.id === li.dataset.milestoneId);
      milestone.done = cb.checked;
      render();
    });
  });

  const milestoneInput = card.querySelector('[data-action="milestone-input"]');
  const addMilestoneBtn = card.querySelector('[data-action="add-milestone"]');

  function addMilestone() {
    const text = milestoneInput.value.trim();
    if (!text) return;
    goal.milestones.push({ id: crypto.randomUUID(), text, done: false });
    render();
  }

  addMilestoneBtn.addEventListener("click", addMilestone);
  milestoneInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      addMilestone();
    }
  });

  return card;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

openFormBtn.addEventListener("click", () => {
  formOverlay.classList.add("open");
  document.getElementById("titleInput").focus();
});

cancelFormBtn.addEventListener("click", closeForm);
formOverlay.addEventListener("click", e => {
  if (e.target === formOverlay) closeForm();
});

function closeForm() {
  formOverlay.classList.remove("open");
  goalForm.reset();
}

goalForm.addEventListener("submit", e => {
  e.preventDefault();

  const title = document.getElementById("titleInput").value.trim();
  const category = document.getElementById("categoryInput").value;
  const deadline = document.getElementById("deadlineInput").value;
  const milestoneText = document.getElementById("milestoneInput").value.trim();

  if (!title) return;

  goals.push({
    id: crypto.randomUUID(),
    title,
    category,
    deadline,
    milestones: milestoneText
      ? [{ id: crypto.randomUUID(), text: milestoneText, done: false }]
      : []
  });

  closeForm();
  render();
});

render();