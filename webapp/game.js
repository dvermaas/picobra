const nameList = JSON.parse(localStorage.getItem('nameList'))
const csvData = localStorage.getItem('csvData')

function updateTheme() {
  const colorMode = window.matchMedia("(prefers-color-scheme: dark)").matches ?
    "dark" :
    "light";
  document.querySelector("html").setAttribute("data-bs-theme", colorMode);
}

// Set theme on load
updateTheme()

function getRandomInt(min, max) {
  // Helper function to generate a random integer between min and max (inclusive)
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomQuestionFromLocalStorageCSV() {
  // Step 1: Read the CSV data from local storage
  const csvDataString = localStorage.getItem("csvData");

  // Step 2: Parse the CSV data using PapaParse
  const { data: rows, errors, meta } = Papa.parse(csvDataString, {
    delimiter: ',',
    header: true,
    skipEmptyLines: true,
  });

  // Step 3: Handle parsing errors, if any
  if (errors.length > 0) {
    console.error("CSV parsing error:", errors);
    return null;
  }

  // Step 4: Generate a random index
  const randomIndex = Math.floor(Math.random() * rows.length);

  // Step 5: Get the randomly selected row
  const randomRow = rows[randomIndex];

  // Step 6: add drink number
  const randomInt = getRandomInt(2, 5);
  let question = randomRow.text.replace(/\$/, randomInt)

  // Step 7 add names
  const randomPlayers = [];
  while (randomPlayers.length < randomRow.nb_players) {
    const randomPlayer = nameList[Math.floor(Math.random() * nameList.length)];
    if (!randomPlayers.includes(randomPlayer)) {
      randomPlayers.push(randomPlayer);
    }
  }
  question = question.replace(/%s/g, () => randomPlayers.pop());

  // Step 8: Return the value of 'question' from the randomly selected row
  return question;
}


document.addEventListener('DOMContentLoaded', function () {
    // Get the big sentence element
    const bigSentenceElement = document.getElementById('question');

    // Set the content of the big sentence
    bigSentenceElement.textContent = getRandomQuestionFromLocalStorageCSV();
});
