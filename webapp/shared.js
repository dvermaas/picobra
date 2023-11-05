function updateTheme() {
    const colorMode = window.matchMedia("(prefers-color-scheme: dark)").matches ?
      "dark" :
      "light";
    document.querySelector("html").setAttribute("data-bs-theme", colorMode);
  }
  
  // Set theme on load
  updateTheme()