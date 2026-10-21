const authConfig = {
  clientId: "7o0l6g510mn5riiqmg7aulr8mt",
  domain: "https://sri-task-tracker-564343772519.auth.us-east-2.amazoncognito.com",
    redirectUri: `${window.location.origin}/`
};

const apiUrl = "https://rvmww4ezne.execute-api.us-east-2.amazonaws.com";
const homePage = document.getElementById("home-page");
const tasksPage = document.getElementById("tasks-page");
const notFoundPage = document.getElementById("not-found-page");
const taskDetailsPage = document.getElementById("task-details-page");

function showPage() {
  const path = window.location.pathname;
  const isTaskDetails = /^\/tasks\/[^/]+$/.test(path);

  homePage.hidden = path !== "/";
  tasksPage.hidden = path !== "/tasks";
  taskDetailsPage.hidden = !isTaskDetails;

  notFoundPage.hidden =
    path === "/" || path === "/tasks" || isTaskDetails;
}
document.querySelectorAll('a[href="/"], a[href="/tasks"]')
  .forEach(link => {
    link.addEventListener("click", event => {
      if (
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      window.history.pushState({}, "", link.getAttribute("href"));
      showPage();
      if (window.location.pathname === "/tasks" && isSignedIn()) {
        loadTasks();
      }
    });
  });

window.addEventListener("popstate", showPage);

const signInButton = document.getElementById("sign-in-button");
const connectionMessage = document.getElementById("connection-message");
const refreshButton = document.getElementById("refresh-button");
const taskList = document.getElementById("task-list");
const taskSummary = document.getElementById("task-summary");
const taskForm = document.getElementById("task-form");
const taskTitle = document.getElementById("task-title");
const addButton = document.getElementById("add-button");
const filterButtons = document.querySelectorAll("[data-filter]");

let busy = false;
let allTasks = [];
let activeFilter = "all";

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomString() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function isSignedIn() {
  return Boolean(sessionStorage.getItem("access_token")) &&
    Date.now() < Number(sessionStorage.getItem("token_expires_at"));
}

function updateControls() {
  const signedIn = isSignedIn();

  signInButton.disabled = busy;
  signInButton.textContent = signedIn ? "Sign out" : "Sign in";
  refreshButton.disabled = !signedIn || busy;
  taskTitle.disabled = !signedIn || busy;
  addButton.disabled = !signedIn || busy;

  for (const button of taskList.querySelectorAll("button")) {
    button.disabled = !signedIn || busy;
  }

  for (const button of filterButtons) {
    button.disabled = !signedIn || busy;
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.filter === activeFilter)
    );
  }
}

function clearSession() {
  allTasks = [];
  activeFilter = "all";

  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("token_expires_at");

  taskList.replaceChildren();
  taskSummary.textContent = "Sign in to view your tasks.";
  updateControls();
}

async function startSignIn() {
  sessionStorage.setItem("return_after_login", window.location.pathname);
  const verifier = randomString();
  const state = randomString();

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );

  sessionStorage.setItem("pkce_verifier", verifier);
  sessionStorage.setItem("login_state", state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: authConfig.clientId,
    redirect_uri: authConfig.redirectUri,
    scope: "openid email profile",
    state,
    code_challenge_method: "S256",
    code_challenge: base64Url(new Uint8Array(digest))
  });

  window.location.assign(
    `${authConfig.domain}/oauth2/authorize?${params}`
  );
}

function signOut() {
  clearSession();

  sessionStorage.removeItem("pkce_verifier");
  sessionStorage.removeItem("login_state");

  const params = new URLSearchParams({
    client_id: authConfig.clientId,
    logout_uri: authConfig.redirectUri
  });

  window.location.assign(`${authConfig.domain}/logout?${params}`);
}

async function finishSignIn() {
  const params = new URLSearchParams(window.location.search);

  if (!params.has("code") && !params.has("error")) {
    return;
  }

  try {
    const savedState = sessionStorage.getItem("login_state");
    const verifier = sessionStorage.getItem("pkce_verifier");

    if (!savedState || params.get("state") !== savedState || !verifier) {
      throw new Error("Login could not be verified. Please sign in again.");
    }

    if (params.has("error")) {
      throw new Error("Sign-in was not completed. Please try again.");
    }

    connectionMessage.textContent = "Completing sign-in…";

    const response = await fetch(`${authConfig.domain}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: authConfig.clientId,
        redirect_uri: authConfig.redirectUri,
        code: params.get("code"),
        code_verifier: verifier
      })
    });

    const tokens = await response.json();

    if (!response.ok || !tokens.access_token || !tokens.expires_in) {
      throw new Error("Sign-in failed. Please try again.");
    }

    sessionStorage.setItem("access_token", tokens.access_token);
    sessionStorage.setItem(
      "token_expires_at",
      String(Date.now() + tokens.expires_in * 1000)
    );
  } catch (error) {
    clearSession();
    throw error;
  } finally {
    sessionStorage.removeItem("pkce_verifier");
    sessionStorage.removeItem("login_state");
    const savedPath = sessionStorage.getItem("return_after_login");
const allowedPath =
  savedPath === "/tasks" ||
  /^\/tasks\/[^/]+$/.test(savedPath || "");

const returnPath = isSignedIn() && allowedPath
  ? savedPath
  : "/";

sessionStorage.removeItem("return_after_login");

window.history.replaceState({}, document.title, returnPath);
showPage();
  }
}

async function apiRequest(path, method = "GET", body) {
  if (!isSignedIn()) {
    clearSession();
    throw new Error("Your session expired. Please sign in again.");
  }

  const headers = {
    Authorization: `Bearer ${sessionStorage.getItem("access_token")}`
  };

  const options = {
    method,
    headers,
    cache: "no-store"
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${apiUrl}${path}`, options);

  if (response.status === 401) {
    clearSession();
    throw new Error("Your session expired. Please sign in again.");
  }

  const text = await response.text();
  let result = {};

  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error("The API returned an unexpected response.");
    }
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Too many requests. Wait a moment and try again.");
    }

    throw new Error(
      result.message || `Request failed (${response.status}).`
    );
  }

  return result;
}

function renderTasks(tasks) {
  allTasks = tasks;

  const visibleTasks = activeFilter === "all"
    ? allTasks
    : allTasks.filter(task => task.status === activeFilter);

  taskList.replaceChildren();

  for (const task of visibleTasks) {
    const item = document.createElement("li");
    item.className = "task-item";

    const details = document.createElement("div");

    const title = document.createElement("a");
    title.href = `/tasks/${encodeURIComponent(task.task_id)}`;
    title.className = "task-title";
    title.textContent = task.title;

    const status = document.createElement("span");
    status.className = "task-status";
    status.textContent = task.status;

    details.append(title, status);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.textContent = task.status === "Completed"
      ? "Mark pending"
      : "Mark complete";

    toggleButton.addEventListener("click", () => {
      changeTaskStatus(task);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
      deleteTask(task);
    });

    actions.append(toggleButton, deleteButton);
    item.append(details, actions);
    taskList.append(item);
  }

  if (allTasks.length === 0) {
    taskSummary.textContent = "No tasks yet. Add your first task above.";
  } else if (visibleTasks.length === 0) {
    taskSummary.textContent =
      `No ${activeFilter.toLowerCase()} tasks.`;
  } else {
    const label = activeFilter === "all" ? "All" : activeFilter;

    taskSummary.textContent =
      `${label}: ${visibleTasks.length} of ${allTasks.length} tasks`;
  }
}
async function loadTaskDetails(taskId) {
  const message = document.getElementById("task-details-message");
  const title = document.getElementById("detail-title");
  const status = document.getElementById("detail-status");
  const created = document.getElementById("detail-created");

  title.textContent = "";
  status.textContent = "";
  created.textContent = "";

  if (!isSignedIn()) {
    message.textContent = "Sign in to view this task.";
    return;
  }

  message.textContent = "Loading task details.";

  try {
    const task = await apiRequest(
      `/tasks/${encodeURIComponent(taskId)}`
    );

    if (window.location.pathname !== `/tasks/${encodeURIComponent(taskId)}`) {
      return;
    }

    title.textContent = task.title;
    status.textContent = task.status;
    created.textContent = new Date(task.created_at).toLocaleString();
    message.textContent = "";
  } catch (error) {
    message.textContent = error.message;
  }
}
async function fetchAndRenderTasks() {
  const result = await apiRequest("/tasks");

  if (!Array.isArray(result.tasks)) {
    throw new Error("The API returned an unexpected response.");
  }

  renderTasks(result.tasks);
}

async function loadTasks() {
  if (busy) {
    return;
  }

  busy = true;
  updateControls();
  connectionMessage.textContent = "Loading your tasks…";

  try {
    await fetchAndRenderTasks();
    connectionMessage.textContent = "Connected. Your tasks are up to date.";
  } catch (error) {
    connectionMessage.textContent = error.message;
  } finally {
    busy = false;
    updateControls();
  }
}

async function changeTaskStatus(task) {
  if (busy) {
    return;
  }

  busy = true;
  updateControls();
  connectionMessage.textContent = "Updating your task…";

  try {
    const updatedTask = await apiRequest(
      `/tasks/${encodeURIComponent(task.task_id)}`,
      "PATCH",
      {
        status: task.status === "Completed" ? "Pending" : "Completed"
      }
    );

    renderTasks(
      allTasks.map(existingTask =>
        existingTask.task_id === updatedTask.task_id
          ? updatedTask
          : existingTask
      )
    );

    connectionMessage.textContent = "Task updated successfully.";
  } catch (error) {
    connectionMessage.textContent = error.message;
  } finally {
    busy = false;
    updateControls();
  }
}

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (busy) {
    return;
  }

  const title = taskTitle.value.trim();

  if (!title) {
    connectionMessage.textContent = "Please enter a task title.";
    return;
  }

  busy = true;
  updateControls();
  connectionMessage.textContent = "Saving your task…";

  try {
    const newTask = await apiRequest("/tasks", "POST", { title });

    taskTitle.value = "";
    activeFilter = "all";
    renderTasks([newTask, ...allTasks]);

    connectionMessage.textContent = "Task added successfully.";
  } catch (error) {
    connectionMessage.textContent = error.message;
  } finally {
    busy = false;
    updateControls();
  }
});

refreshButton.addEventListener("click", loadTasks);

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    if (busy || !isSignedIn()) {
      return;
    }

    activeFilter = button.dataset.filter;
    renderTasks(allTasks);
    updateControls();
  });
}

signInButton.addEventListener("click", async () => {
  if (busy) {
    return;
  }

  try {
    if (isSignedIn()) {
      signOut();
    } else {
      clearSession();
      await startSignIn();
    }
  } catch (error) {
    connectionMessage.textContent =
      `Unable to start sign-in: ${error.message}`;
  }
});

async function initialize() {
  showPage();

  busy = true;
  updateControls();

  try {
    await finishSignIn();

    if (isSignedIn()) {
      connectionMessage.textContent = "Loading your tasks…";
      const match = window.location.pathname.match(/^\/tasks\/([^/]+)$/);

      if (match) {
        await loadTaskDetails(decodeURIComponent(match[1]));
      } else {
        await fetchAndRenderTasks();
      }
      connectionMessage.textContent = "Connected. Your tasks are up to date.";
    } else {
      clearSession();
      connectionMessage.textContent = "Sign in to access your tasks.";
    }
  } catch (error) {
    connectionMessage.textContent = error.message;
  } finally {
    busy = false;
    updateControls();
  }
}
async function deleteTask(task) {
  if (busy) {
    return;
  }

  if (!isSignedIn()) {
    clearSession();
    connectionMessage.textContent = "Please sign in again.";
    return;
  }

  const confirmed = window.confirm(
    `Delete "${task.title}"? This cannot be undone from the website.`
  );

  if (!confirmed) {
    return;
  }

  busy = true;
  updateControls();
  connectionMessage.textContent = "Deleting your task…";

  try {
    await apiRequest(
      `/tasks/${encodeURIComponent(task.task_id)}`,
      "DELETE"
    );

    renderTasks(
      allTasks.filter(existingTask =>
        existingTask.task_id !== task.task_id
      )
    );

    connectionMessage.textContent = "Task deleted successfully.";
  } catch (error) {
    connectionMessage.textContent = error.message;
  } finally {
    busy = false;
    updateControls();
  }
}
initialize();