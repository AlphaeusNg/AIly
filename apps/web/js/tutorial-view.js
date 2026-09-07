import { CHAPTERS, chapterStatus, isReady } from "./tutorial.js";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownLite(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

export function renderTutorialContent({ state, actions }) {
  const pending = CHAPTERS.find((chapter) => chapterStatus(state, chapter.id) === "pending") || CHAPTERS[0];
  document.querySelector("#tutorial-title").textContent = pending.title;
  document.querySelector("#tutorial-body").innerHTML = markdownLite(pending.body);
  document.querySelector("#tutorial-progress").textContent = `${
    CHAPTERS.filter((chapter) => chapterStatus(state, chapter.id) === "done").length
  }/${CHAPTERS.length} chapters`;
  const container = document.querySelector("#tutorial-actions");
  container.innerHTML = "";
  if (pending.grant) {
    const button = document.createElement("button");
    button.className = "primary";
    button.textContent =
      pending.grant === "usage"
        ? "Grant usage permission"
        : pending.grant === "blockAdmin"
          ? "Grant block admin"
          : "Allow notifications";
    button.onclick = () => actions.grant(pending);
    container.appendChild(button);
  } else if (pending.id === "first_target") {
    container.innerHTML = `<p class="muted">Create a target in the Targets tab, then mark done.</p>`;
    const button = document.createElement("button");
    button.className = "primary";
    button.textContent = state.targets.length ? "I created a target — continue" : "Go to Targets";
    button.onclick = () => {
      if (!state.targets.length) actions.goToTargets();
      else actions.complete("first_target");
    };
    container.appendChild(button);
  } else if (pending.id === "capacity") {
    container.innerHTML = `
      <label>Weekly hours <input type="number" id="tut-hours" min="1" max="80" value="${state.user.weeklyCapacityHours}" /></label>
      <label>Nights/week <input type="number" id="tut-nights" min="1" max="7" value="${state.user.nightsPerWeek}" /></label>
    `;
    const button = document.createElement("button");
    button.className = "primary";
    button.textContent = "Save capacity";
    button.onclick = () => {
      actions.saveCapacity(
        Number(document.querySelector("#tut-hours").value) || 10,
        Number(document.querySelector("#tut-nights").value) || 4,
      );
    };
    container.appendChild(button);
  } else {
    const button = document.createElement("button");
    button.className = "primary";
    button.textContent = pending.id === "meet" ? "Nice to meet you" : "Continue";
    button.onclick = () => actions.complete(pending.id);
    container.appendChild(button);
  }
  if (!pending.required) {
    const button = document.createElement("button");
    button.textContent = "Skip for now";
    button.onclick = () => actions.skip(pending.id);
    container.appendChild(button);
  }
  if (isReady(state)) {
    const button = document.createElement("button");
    button.textContent = "Enter AIly";
    button.className = "primary";
    button.onclick = actions.enter;
    container.appendChild(button);
  }
}
