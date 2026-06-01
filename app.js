const factors = Array.from({ length: 12 }, (_, index) => index + 1);
const storageKey = "multiplication-lab-progress-v1";

const state = {
  selectedFactors: new Set(factors),
  progress: loadProgress(),
  session: null,
  current: null,
  timerId: null,
  startedAt: null
};

const elements = {
  heroArray: document.querySelector("#hero-array"),
  factorButtons: document.querySelector("#factor-buttons"),
  mode: document.querySelector("#mode"),
  focusWrap: document.querySelector("#focus-wrap"),
  focusFactor: document.querySelector("#focus-factor"),
  sessionLength: document.querySelector("#session-length"),
  timerEnabled: document.querySelector("#timer-enabled"),
  startSession: document.querySelector("#start-session"),
  resetProgress: document.querySelector("#reset-progress"),
  expression: document.querySelector("#problem-expression"),
  form: document.querySelector("#answer-form"),
  answer: document.querySelector("#answer-input"),
  feedback: document.querySelector("#feedback"),
  answeredCount: document.querySelector("#answered-count"),
  accuracy: document.querySelector("#accuracy"),
  timer: document.querySelector("#timer"),
  skip: document.querySelector("#skip-question"),
  reveal: document.querySelector("#reveal-answer"),
  endSession: document.querySelector("#end-session"),
  sessionSummary: document.querySelector("#session-summary"),
  summaryTitle: document.querySelector("#summary-title"),
  summaryTime: document.querySelector("#summary-time"),
  summaryGrid: document.querySelector("#summary-grid"),
  suggestions: document.querySelector("#suggestions"),
  masteryLabel: document.querySelector("#mastery-label"),
  masteryMeter: document.querySelector("#mastery-meter"),
  progressList: document.querySelector("#progress-list"),
  timesTable: document.querySelector("#times-table")
};

function keyFor(a, b) {
  return `${Math.min(a, b)}x${Math.max(a, b)}`;
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(storageKey, JSON.stringify(state.progress));
}

function getFactStats(a, b) {
  const key = keyFor(a, b);
  return state.progress[key] || { correct: 0, missed: 0, streak: 0, lastSeen: 0 };
}

function setFactStats(a, b, stats) {
  state.progress[keyFor(a, b)] = stats;
  saveProgress();
}

function accuracyFor(a, b) {
  const stats = getFactStats(a, b);
  const total = stats.correct + stats.missed;
  return total ? stats.correct / total : 0;
}

function masteryForFactor(factor) {
  const scores = factors.map((other) => accuracyFor(factor, other));
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function overallMastery() {
  const scores = [];
  for (let a = 1; a <= 12; a += 1) {
    for (let b = a; b <= 12; b += 1) {
      scores.push(accuracyFor(a, b));
    }
  }
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function renderHeroArray() {
  elements.heroArray.innerHTML = "";
  for (let index = 0; index < 42; index += 1) {
    elements.heroArray.append(document.createElement("span"));
  }
}

function renderFactorButtons() {
  elements.factorButtons.innerHTML = "";
  factors.forEach((factor) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = factor;
    button.className = state.selectedFactors.has(factor) ? "active" : "";
    button.setAttribute("aria-pressed", String(state.selectedFactors.has(factor)));
    button.addEventListener("click", () => {
      if (state.selectedFactors.has(factor) && state.selectedFactors.size > 1) {
        state.selectedFactors.delete(factor);
      } else {
        state.selectedFactors.add(factor);
      }
      renderFactorButtons();
    });
    elements.factorButtons.append(button);
  });
}

function renderTimesTable() {
  elements.timesTable.innerHTML = "";
  const cells = ["", ...factors];
  cells.forEach((label) => appendCell(label, "header"));

  factors.forEach((row) => {
    appendCell(row, "header");
    factors.forEach((column) => {
      const cell = appendCell(row * column);
      const stats = getFactStats(row, column);
      if (stats.correct + stats.missed > 0) {
        cell.classList.add(accuracyFor(row, column) >= 0.8 ? "mastered" : "needs-work");
      }
      cell.title = `${row} x ${column}`;
    });
  });
}

function appendCell(text, className = "") {
  const cell = document.createElement("div");
  cell.className = `cell ${className}`.trim();
  cell.textContent = text;
  elements.timesTable.append(cell);
  return cell;
}

function renderProgress() {
  const mastery = overallMastery();
  elements.masteryMeter.style.width = `${Math.round(mastery * 100)}%`;
  elements.masteryLabel.textContent = mastery > 0 ? `${Math.round(mastery * 100)}% general` : "Sin datos todavía";
  elements.progressList.innerHTML = "";

  factors.forEach((factor) => {
    const row = document.createElement("div");
    row.className = "progress-row";
    const score = masteryForFactor(factor);
    row.innerHTML = `
      <strong>x${factor}</strong>
      <span class="mini-meter"><span style="width: ${Math.round(score * 100)}%"></span></span>
      <span>${Math.round(score * 100)}%</span>
    `;
    elements.progressList.append(row);
  });
}

function buildQuestionPool() {
  const selected = [...state.selectedFactors];
  const mode = elements.mode.value;
  const focus = clamp(Number(elements.focusFactor.value), 1, 12);

  if (mode === "focus") {
    return factors.map((other) => [focus, other]);
  }

  const pool = [];
  selected.forEach((factor) => {
    factors.forEach((other) => pool.push([factor, other]));
  });

  if (mode === "adaptive") {
    return pool.flatMap(([a, b]) => {
      const stats = getFactStats(a, b);
      const total = stats.correct + stats.missed;
      const needsWork = total === 0 || accuracyFor(a, b) < 0.8;
      return needsWork ? [[a, b], [a, b], [a, b]] : [[a, b]];
    });
  }

  return pool;
}

function startSession() {
  const length = clamp(Number(elements.sessionLength.value), 5, 50);
  state.session = {
    length,
    active: true,
    answered: 0,
    correct: 0,
    missed: 0,
    mistakes: [],
    pool: buildQuestionPool()
  };
  state.startedAt = Date.now();
  clearInterval(state.timerId);
  state.timerId = setInterval(updateTimer, 250);
  elements.sessionSummary.hidden = true;
  elements.endSession.disabled = false;
  elements.feedback.className = "feedback";
  elements.feedback.textContent = "Escribe el producto y presiona Revisar.";
  nextQuestion();
  updateStats();
  elements.answer.focus();
}

function nextQuestion() {
  if (!state.session || !state.session.active) return;
  if (state.session.answered >= state.session.length) {
    finishSession("completed");
    return;
  }

  const [a, b] = pickQuestion();
  state.current = { a, b, answer: a * b };
  elements.expression.textContent = `${a} x ${b}`;
  elements.answer.value = "";
}

function pickQuestion() {
  const pool = state.session.pool;
  return pool[Math.floor(Math.random() * pool.length)];
}

function checkAnswer(event) {
  event.preventDefault();
  if (!state.session || !state.session.active || !state.current) return;

  const value = Number(elements.answer.value);
  if (!Number.isFinite(value)) return;

  const isCorrect = value === state.current.answer;
  recordAnswer(isCorrect, value);

  if (isCorrect) {
    elements.feedback.className = "feedback correct";
    elements.feedback.textContent = "Correcto. Muy bien.";
    window.setTimeout(nextQuestion, 450);
  } else {
    elements.feedback.className = "feedback incorrect";
    elements.feedback.textContent = `Casi. ${state.current.a} x ${state.current.b} = ${state.current.answer}.`;
    window.setTimeout(nextQuestion, 900);
  }
}

function recordAnswer(isCorrect, givenAnswer = null) {
  const { a, b } = state.current;
  const stats = getFactStats(a, b);
  const updated = {
    correct: stats.correct + (isCorrect ? 1 : 0),
    missed: stats.missed + (isCorrect ? 0 : 1),
    streak: isCorrect ? stats.streak + 1 : 0,
    lastSeen: Date.now()
  };
  setFactStats(a, b, updated);

  state.session.answered += 1;
  state.session.correct += isCorrect ? 1 : 0;
  state.session.missed += isCorrect ? 0 : 1;

  if (!isCorrect) {
    state.session.mistakes.push({
      a,
      b,
      expected: a * b,
      given: givenAnswer
    });
  }

  updateStats();
  renderProgress();
  renderTimesTable();
}

function skipQuestion() {
  if (!state.session || !state.session.active || !state.current) return;
  recordAnswer(false, null);
  elements.feedback.className = "feedback incorrect";
  elements.feedback.textContent = `Saltada. ${state.current.a} x ${state.current.b} = ${state.current.answer}.`;
  window.setTimeout(nextQuestion, 650);
}

function revealAnswer() {
  if (!state.current) return;
  elements.feedback.className = "feedback";
  elements.feedback.textContent = `${state.current.a} x ${state.current.b} = ${state.current.answer}`;
}

function finishSession(reason = "manual") {
  if (!state.session) return;
  state.session.active = false;
  clearInterval(state.timerId);
  state.timerId = null;
  state.current = null;
  elements.endSession.disabled = true;
  elements.expression.textContent = "Sesión completa";
  elements.feedback.className = "feedback correct";
  elements.feedback.textContent = reason === "manual" ? "Sesion cerrada. Revisa tu resumen." : summaryText();
  renderSessionSummary();
}

function summaryText() {
  const { answered, correct } = state.session;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  return `Respondiste ${answered} preguntas con ${accuracy}% de precisión.`;
}

function renderSessionSummary() {
  const session = state.session;
  const elapsed = elapsedSeconds();
  const accuracy = session.answered ? Math.round((session.correct / session.answered) * 100) : 0;
  const pace = session.answered && elapsed ? Math.round(elapsed / session.answered) : 0;
  const toughestFactor = findToughestFactor(session.mistakes);

  elements.sessionSummary.hidden = false;
  elements.summaryTitle.textContent = session.missed
    ? "Buen cierre: ya sabemos que practicar"
    : "Excelente: sesion sin errores";
  elements.summaryTime.textContent = formatTime(elapsed);
  elements.summaryGrid.innerHTML = `
    <div class="summary-metric">
      <strong>${session.answered}</strong>
      <span>preguntas</span>
    </div>
    <div class="summary-metric">
      <strong>${accuracy}%</strong>
      <span>precision</span>
    </div>
    <div class="summary-metric">
      <strong>${session.missed}</strong>
      <span>errores</span>
    </div>
    <div class="summary-metric">
      <strong>${pace || "-"}s</strong>
      <span>por pregunta</span>
    </div>
  `;
  elements.suggestions.innerHTML = buildSuggestions(session.mistakes, toughestFactor).join("");
}

function buildSuggestions(mistakes, toughestFactor) {
  if (!mistakes.length) {
    return [
      suggestionCard(
        "Mantener el ritmo",
        "No hubo errores en esta sesion. Para consolidar, repite una ronda corta con menos tiempo o agrega mas factores."
      )
    ];
  }

  const suggestions = [];
  const facts = summarizeMistakes(mistakes);
  suggestions.push(
    suggestionCard(
      "Errores para repasar",
      `Vuelve a practicar: ${facts.map((fact) => `${fact.a} x ${fact.b} = ${fact.expected}`).join(", ")}.`
    )
  );

  if (toughestFactor) {
    suggestions.push(
      suggestionCard(
        `Tabla del ${toughestFactor}`,
        `Fue la tabla que mas aparecio en los errores. Haz una mini sesion en modo "Factor especifico" con el ${toughestFactor}.`
      )
    );
  }

  if (mistakes.some((mistake) => mistake.a === 9 || mistake.b === 9)) {
    suggestions.push(
      suggestionCard(
        "Regla de la tabla del 9",
        "Para 9 x 1 hasta 9 x 10, las dos cifras del resultado suman 9: 9 x 7 = 63 y 6 + 3 = 9. Tambien puedes bajar un dedo: quedan 6 dedos a la izquierda y 3 a la derecha."
      )
    );
  }

  if (mistakes.some((mistake) => mistake.a === 5 || mistake.b === 5)) {
    suggestions.push(
      suggestionCard(
        "Pista para la tabla del 5",
        "Los resultados de la tabla del 5 siempre terminan en 0 o en 5. Si el otro factor es par termina en 0; si es impar termina en 5."
      )
    );
  }

  if (mistakes.some((mistake) => mistake.a === 11 || mistake.b === 11)) {
    suggestions.push(
      suggestionCard(
        "Pista para la tabla del 11",
        "Del 1 al 9, multiplicar por 11 repite el numero: 11 x 6 = 66. Para 11 x 10, 11 x 11 y 11 x 12, piensa en sumar una tabla mas de 11."
      )
    );
  }

  if (mistakes.some((mistake) => mistake.a === 2 || mistake.b === 2)) {
    suggestions.push(
      suggestionCard(
        "Pista para la tabla del 2",
        "Multiplicar por 2 es duplicar. Si cuesta 2 x 8, piensa 8 + 8 = 16."
      )
    );
  }

  return suggestions;
}

function suggestionCard(title, body) {
  return `
    <article class="suggestion-card">
      <h3>${title}</h3>
      <p>${body}</p>
    </article>
  `;
}

function summarizeMistakes(mistakes) {
  const grouped = new Map();
  mistakes.forEach((mistake) => {
    const key = keyFor(mistake.a, mistake.b);
    const existing = grouped.get(key) || { ...mistake, count: 0 };
    existing.count += 1;
    grouped.set(key, existing);
  });
  return [...grouped.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);
}

function findToughestFactor(mistakes) {
  if (!mistakes.length) return null;
  const counts = new Map();
  mistakes.forEach(({ a, b }) => {
    counts.set(a, (counts.get(a) || 0) + 1);
    counts.set(b, (counts.get(b) || 0) + 1);
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
}

function updateStats() {
  const session = state.session || { answered: 0, correct: 0 };
  const accuracy = session.answered ? Math.round((session.correct / session.answered) * 100) : 0;
  elements.answeredCount.textContent = session.answered;
  elements.accuracy.textContent = `${accuracy}%`;
}

function updateTimer() {
  if (!elements.timerEnabled.checked || !state.startedAt) {
    elements.timer.textContent = "sin cronómetro";
    return;
  }

  elements.timer.textContent = formatTime(elapsedSeconds());
}

function elapsedSeconds() {
  return state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0;
}

function formatTime(totalSeconds) {
  const elapsed = Math.max(0, totalSeconds);
  const minutes = Math.floor(elapsed / 60);
  const seconds = String(elapsed % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value || min));
}

function resetProgress() {
  if (!confirm("¿Reiniciar todo el progreso en este dispositivo?")) return;
  state.progress = {};
  saveProgress();
  renderProgress();
  renderTimesTable();
  elements.feedback.className = "feedback";
  elements.feedback.textContent = "Progreso reiniciado.";
}

function syncModeControls() {
  elements.focusWrap.hidden = elements.mode.value !== "focus";
}

elements.startSession.addEventListener("click", startSession);
elements.form.addEventListener("submit", checkAnswer);
elements.skip.addEventListener("click", skipQuestion);
elements.reveal.addEventListener("click", revealAnswer);
elements.endSession.addEventListener("click", () => finishSession("manual"));
elements.resetProgress.addEventListener("click", resetProgress);
elements.mode.addEventListener("change", syncModeControls);
elements.timerEnabled.addEventListener("change", updateTimer);

renderHeroArray();
renderFactorButtons();
renderProgress();
renderTimesTable();
syncModeControls();
