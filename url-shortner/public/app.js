const form = document.querySelector("#shorten-form");
const input = document.querySelector("#long-url");
const resultPanel = document.querySelector("#result-panel");
const shortUrlLink = document.querySelector("#short-url");
const linksList = document.querySelector("#links-list");
const emptyState = document.querySelector("#empty-state");
const refreshButton = document.querySelector("#refresh-links");

function renderLinks(links) {
  linksList.innerHTML = "";
  emptyState.hidden = links.length > 0;

  for (const link of links) {
    const item = document.createElement("li");
    item.className = "link-item";

    const shortLink = document.createElement("a");
    shortLink.href = `/${link.code}`;
    shortLink.textContent = `${window.location.origin}/${link.code}`;

    const longUrl = document.createElement("span");
    longUrl.textContent = link.longUrl;

    const clicks = document.createElement("span");
    clicks.textContent = `Clicks: ${link.clicks}`;

    item.append(shortLink, longUrl, clicks);
    linksList.append(item);
  }
}

async function loadLinks() {
  const response = await fetch("/api/links");
  const data = await response.json();
  renderLinks(data.links);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  shortUrlLink.classList.remove("error");
  shortUrlLink.textContent = "Creating...";
  resultPanel.hidden = false;

  const response = await fetch("/api/shorten", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      longUrl: input.value
    })
  });

  const data = await response.json();

  if (!response.ok) {
    shortUrlLink.removeAttribute("href");
    shortUrlLink.classList.add("error");
    shortUrlLink.textContent = data.error ?? "Could not create short URL";
    return;
  }

  shortUrlLink.href = data.shortUrl;
  shortUrlLink.textContent = data.shortUrl;
  input.value = "";
  await loadLinks();
});

refreshButton.addEventListener("click", loadLinks);

await loadLinks();
