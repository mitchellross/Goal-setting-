let goals = JSON.parse(localStorage.getItem("goals")) || [];
let editingGoalId = null;

const trailEl = document.getElementById("trail");
const emptyStateEl = document.getElementById("emptyState");
const formOverlay = document.getElementById("formOverlay");
const goalForm = document.getElementById("goalForm");
const openFormBtn = document.getElementById("openFormBtn");
const cancelFormBtn = document.getElementById("cancelFormBtn");
const formTitle = document.getElementById("formTitle");
const submitFormBtn = document.getElementById("submitFormBtn");
const milestoneField = document.getElementById("milestoneField");

const titleInput = document.getElementById("titleInput");
const categoryInput = document.getElementById("categoryInput");
const deadlineInput = document.getElementById("deadlineInput");
const milestoneInput = document.getElementById("milestoneInput");
const helpOverlay = document.getElementById("helpOverlay");
const helpTitle = document.getElementById("helpTitle");
const helpText = document.getElementById("helpText");
const closeHelpBtn = document.getElementById("closeHelpBtn");

const statTotal = document.getElementById("statTotal");
const statDone = document.getElementById("statDone");
const statAvg = document.getElementById("statAvg");

function saveGoals() {
  localStorage.setItem("goals", JSON.stringify(goals));
}

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
        <div class="goal-actions">
          <button class="icon-btn edit" data-action="edit" title="Edit goal">Edit</button>
          <button class="icon-btn" data-action="delete" title="Remove goal">x</button>
        </div>
      </div>
      <div class="goal-meta">
        <span class="tag">${escapeHtml(goal.category)}</span>
        ${deadlineInfo ? `<span class="tag deadline ${deadlineInfo.overdue && !complete ? "overdue" : ""}">${deadlineInfo.overdue && !complete ? "Overdue - " : "By "}${deadlineInfo.label}</span>` : ""}
      </div>
      <ul class="milestones">
        ${goal.milestones.map(m => `
          <li class="milestone ${m.done ? "done" : ""}" data-milestone-id="${m.id}">
            <input type="checkbox" ${m.done ? "checked" : ""} data-action="toggle-milestone">
            <span class="milestone-text">${escapeHtml(m.text)}</span>
            <div class="milestone-actions">
              <button class="mini-btn" data-action="edit-milestone" title="Edit sub-goal">Edit</button>
              <button class="mini-btn danger" data-action="delete-milestone" title="Delete sub-goal">Delete</button>
              <button class="mini-btn help" data-action="help-milestone" title="Get quick help">Help</button>
            </div>
          </li>
        `).join("")}
      </ul>
      <div class="add-milestone">
        <input type="text" placeholder="Add a milestone..." data-action="milestone-input">
        <button data-action="add-milestone">+</button>
      </div>
    </div>
  `;

  card.querySelector('[data-action="edit"]').addEventListener("click", () => {
    openGoalForm(goal);
  });

  card.querySelector('[data-action="delete"]').addEventListener("click", () => {
    goals = goals.filter(g => g.id !== goal.id);
    saveGoals();
    render();
  });

  card.querySelectorAll('[data-action="toggle-milestone"]').forEach(cb => {
    cb.addEventListener("change", () => {
      const li = cb.closest("[data-milestone-id]");
      const milestone = goal.milestones.find(m => m.id === li.dataset.milestoneId);
      milestone.done = cb.checked;
      saveGoals();
      render();
    });
  });

  card.querySelectorAll('[data-action="edit-milestone"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const li = btn.closest("[data-milestone-id]");
      const milestone = goal.milestones.find(m => m.id === li.dataset.milestoneId);
      renderMilestoneEditor(li, milestone, goal);
    });
  });

  card.querySelectorAll('[data-action="delete-milestone"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const li = btn.closest("[data-milestone-id]");
      goal.milestones = goal.milestones.filter(m => m.id !== li.dataset.milestoneId);
      saveGoals();
      render();
    });
  });

  card.querySelectorAll('[data-action="help-milestone"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const li = btn.closest("[data-milestone-id]");
      const milestone = goal.milestones.find(m => m.id === li.dataset.milestoneId);
      getMilestoneHelp(goal, milestone, btn);
    });
  });

  const newMilestoneInput = card.querySelector('[data-action="milestone-input"]');
  const addMilestoneBtn = card.querySelector('[data-action="add-milestone"]');

  function addMilestone() {
    const text = newMilestoneInput.value.trim();
    if (!text) return;

    goal.milestones.push({
      id: crypto.randomUUID(),
      text,
      done: false
    });

    saveGoals();
    render();
  }

  addMilestoneBtn.addEventListener("click", addMilestone);

  newMilestoneInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      addMilestone();
    }
  });

  return card;
}

function renderMilestoneEditor(li, milestone, goal) {
  li.classList.add("editing");
  li.innerHTML = `
    <input class="milestone-edit-input" type="text" value="${escapeAttribute(milestone.text)}">
    <div class="milestone-actions">
      <button class="mini-btn save" data-action="save-milestone">Save</button>
      <button class="mini-btn" data-action="cancel-milestone">Cancel</button>
    </div>
  `;

  const input = li.querySelector(".milestone-edit-input");
  input.focus();
  input.select();

  function saveMilestone() {
    const text = input.value.trim();
    if (!text) return;

    milestone.text = text;
    saveGoals();
    render();
  }

  li.querySelector('[data-action="save-milestone"]').addEventListener("click", saveMilestone);
  li.querySelector('[data-action="cancel-milestone"]').addEventListener("click", render);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveMilestone();
    }

    if (e.key === "Escape") {
      e.preventDefault();
      render();
    }
  });
}

async function getMilestoneHelp(goal, milestone, button) {
  if (!milestone) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "...";
  showHelpModal("Getting help", "Looking for a quick suggestion...");

  try {
    const response = await fetch("/api/milestone-help", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: goal.title,
        milestone: milestone.text
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Help is not available right now.");
    }

    showHelpModal("Quick suggestions", data.suggestion || "Try breaking this into one small step you can do today.");
  } catch (error) {
    showHelpModal("Help unavailable", error.message || "Try again in a minute.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function showHelpModal(title, text) {
  helpTitle.textContent = title;
  helpText.textContent = text;
  helpOverlay.classList.add("open");
  helpOverlay.setAttribute("aria-hidden", "false");
}

function closeHelpModal() {
  helpOverlay.classList.remove("open");
  helpOverlay.setAttribute("aria-hidden", "true");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttribute(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

function openGoalForm(goal = null) {
  editingGoalId = goal ? goal.id : null;
  formTitle.textContent = goal ? "Edit goal" : "Plot a new goal";
  submitFormBtn.textContent = goal ? "Save changes" : "Add goal";
  milestoneField.style.display = goal ? "none" : "block";

  titleInput.value = goal ? goal.title : "";
  categoryInput.value = goal ? goal.category : "Personal";
  deadlineInput.value = goal ? goal.deadline : "";
  milestoneInput.value = "";

  formOverlay.classList.add("open");
  titleInput.focus();
}

function closeForm() {
  formOverlay.classList.remove("open");
  editingGoalId = null;
  formTitle.textContent = "Plot a new goal";
  submitFormBtn.textContent = "Add goal";
  milestoneField.style.display = "block";
  goalForm.reset();
}

openFormBtn.addEventListener("click", () => openGoalForm());
cancelFormBtn.addEventListener("click", closeForm);
formOverlay.addEventListener("click", e => {
  if (e.target === formOverlay) closeForm();
});
closeHelpBtn.addEventListener("click", closeHelpModal);
helpOverlay.addEventListener("click", e => {
  if (e.target === helpOverlay) closeHelpModal();
});

goalForm.addEventListener("submit", e => {
  e.preventDefault();

  const title = titleInput.value.trim();
  const category = categoryInput.value;
  const deadline = deadlineInput.value;
  const milestoneText = milestoneInput.value.trim();

  if (!title) return;

  if (editingGoalId) {
    goals = goals.map(goal => goal.id === editingGoalId
      ? { ...goal, title, category, deadline }
      : goal);
  } else {
    const newGoal = {
      id: crypto.randomUUID(),
      title,
      category,
      deadline,
      milestones: milestoneText
        ? [{ id: crypto.randomUUID(), text: milestoneText, done: false }]
        : []
    };
    goals.push(newGoal);
  }

  saveGoals();
  closeForm();
  render();
});

render();
