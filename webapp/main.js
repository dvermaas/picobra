// ===== NAME LIST LOGIC =====

const existingList = JSON.parse(localStorage.getItem('nameList')) || [];
function addName(name) {
  existingList.push(name);
  localStorage.setItem('nameList', JSON.stringify(existingList));
}

function removeName(name) {
  const index = existingList.indexOf(name);
  if (index !== -1) {
    existingList.splice(index, 1);
    localStorage.setItem('nameList', JSON.stringify(existingList));
  }
}

// ===== CSV LOGIC =====

function fetchCSVDataFromGitHub() {
  const githubRepoUrl = 'https://github.com/dvermaas/picobra/tree/master/extraction/nl_default.csv';

  return fetch(githubRepoUrl)
    .then(response => response.text())
    .then(csvData => {
      localStorage.setItem('csvData', csvData);
      console.log('CSV data fetched from GitHub and stored locally.');
    })
    .catch(error => {
      console.log('Error fetching CSV data from GitHub:', error);
    });
}

function isCSVDataStoredLocally() {
  return localStorage.getItem('csvData') !== null;
}

if (!isCSVDataStoredLocally()) {
  fetchCSVDataFromGitHub();
} else {
  console.log('CSV data is already stored locally.');
}

// ===== MAIN PAGE LOGIC =====

function updateTheme() {
  const colorMode = window.matchMedia("(prefers-color-scheme: dark)").matches ?
    "dark" :
    "light";
  document.querySelector("html").setAttribute("data-bs-theme", colorMode);
}

// Set theme on load
updateTheme()

document.addEventListener("DOMContentLoaded", function() {
  const searchBar = document.getElementById("search-input");
  const pillContainer = document.getElementById("pill-container");

  searchBar.addEventListener("keyup", function(event) {
    if (event.key === "Enter") addPill(searchBar.value);
  });

  function addPill(text) {
    if (text.trim() !== "") {
      const pill = document.createElement("div");
      pill.classList.add("pill");
      pill.innerHTML = `<span>${text}</span><span class="dismiss">&nbsp&times;</span>`;
      addName(text)
      pillContainer.appendChild(pill);

      const dismissButton = pill.querySelector(".dismiss");
      dismissButton.addEventListener("click", function() {
        removeName(text)
        pillContainer.removeChild(pill);
      });

      searchBar.value = "";

      pillContainer.scrollTop = pillContainer.scrollHeight
    }
  }
});