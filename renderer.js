
const $ = id => document.getElementById(id);
let selectedExe = "";

function showPage(page) {
  document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".nav").forEach(x => x.classList.remove("active"));
  $(page).classList.add("active");
  document.querySelector(`.nav[data-page="${page}"]`)?.classList.add("active");
}
document.querySelectorAll(".nav").forEach(b => b.addEventListener("click", () => showPage(b.dataset.page)));

async function chooseExe() {
  const exe = await window.kay.pickExe();
  if (!exe) return;
  selectedExe = exe;
  $("exe").value = exe;
  if (!$("prefix").value) $("prefix").value = exe.split("/").pop().replace(/\.exe$/i, "");
  const d = await window.kay.diagnose(exe);
  $("runtime").textContent = `${d.api} detected`;
  $("runtimeDetail").textContent = d.summary;
  if ($("backend").value === "Auto") $("backend").value = "Auto";
}
["choose","chooseTop","chooseGames"].forEach(id => $(id).addEventListener("click", chooseExe));

function config() {
  return {
    exe: selectedExe || $("exe").value,
    prefix: $("prefix").value,
    backend: $("backend").value,
    arguments: $("args").value,
    workingDirectory: $("cwd").value
  };
}

$("launch").addEventListener("click", async () => {
  if (!config().exe) return alert("Choose a Windows .exe first.");
  $("launch").disabled = true;
  $("launch").textContent = "Launching...";
  try {
    const result = await window.kay.launch(config());
    if (!result.ok) alert(result.message);
    else if (result.code !== 0) alert(`Game exited with code ${result.code}.\n\n${result.output}`);
  } catch (e) {
    alert(e.message);
  } finally {
    $("launch").disabled = false;
    $("launch").textContent = "▶ Run Game";
  }
});

$("install").addEventListener("click", async () => {
  if (!config().exe) return alert("Choose a Windows .exe first.");
  try {
    const result = await window.kay.installApp(config());
    alert(`Installed:\n${result}`);
  } catch (e) {
    alert(e.message);
  }
});

async function setup() { await window.kay.gamingSetup(); }
async function prefixes() { await window.kay.openFolder("prefixes"); }
async function apps() { await window.kay.openFolder("applications"); }

$("setupBtn").onclick = setup;
$("setupPage").onclick = setup;
$("prefixBtn").onclick = prefixes;
$("prefixPage").onclick = prefixes;
$("appsBtn").onclick = apps;

$("runtime").textContent = "Ready";
$("runtimeDetail").textContent = "Choose a game to run automatic graphics diagnosis.";
