// document.addEventListener("DOMContentLoaded", function() {
//       var searchInput = document.getElementById("search-input");
//       var pillContainer = document.getElementById("pill-container");
//
//       searchInput.addEventListener("keyup", function(event) {
//         if (event.keyCode === 13) { // Check if Enter key is pressed
//           var searchText = searchInput.value.trim();
//           if (searchText !== "") {
//             var pill = document.createElement("div");
//             pill.className = "pill";
//             pill.innerHTML = searchText;
//
//             var dismissButton = document.createElement("button");
//             dismissButton.className = "dismiss-button";
//             dismissButton.innerHTML = "x";
//             dismissButton.addEventListener("click", function() {
//               pill.remove();
//             });
//
//             pill.appendChild(dismissButton);
//             pillContainer.appendChild(pill);
//             searchInput.value = "";
//           }
//         }
//       });
//     });
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
  const addButton = document.getElementById("add-button");
  const pillContainer = document.getElementById("pill-container");

  addButton.addEventListener("click", function(event) {
    event.preventDefault()
    addPill(searchBar.value);
  });
  searchBar.addEventListener("keyup", function(event) {
    if (event.key === "Enter") addPill(searchBar.value);
  });

  function addPill(text) {
    if (text.trim() !== "") {
      const pill = document.createElement("div");
      pill.classList.add("pill");
      pill.innerHTML = `<span>${text}</span><span class="dismiss">&nbsp&times;</span>`;
      pillContainer.appendChild(pill);

      const dismissButton = pill.querySelector(".dismiss");
      dismissButton.addEventListener("click", function() {
        pillContainer.removeChild(pill);
      });

      searchBar.value = "";

      pillContainer.scrollTop = pillContainer.scrollHeight
    }
  }
});