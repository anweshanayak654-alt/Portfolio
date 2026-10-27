(function () {
  const THEME_KEY = "theme";
  const sections = ["about", "skills", "projects", "achievements", "contact"];

  initYear();
  initProfileFallback();
  initTheme();
  initNav();
  initContactForm();
  initProjects();

  function initYear() {
    const year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  function initProfileFallback() {
    const img = document.getElementById("profile-image");
    const fallback = document.querySelector(".avatar-fallback");
    if (!img || !fallback) return;

    img.addEventListener("error", function () {
      img.hidden = true;
      fallback.hidden = false;
    });
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (err) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (err) {
      /* ignore quota / private mode */
    }
  }

  function getInitialTheme() {
    const stored = getStoredTheme();
    if (stored === "light" || stored === "dark") return stored;

    // Default to the soft pastel vintage scrapbook theme
    return "light";
  }

  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = next;

    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;

    const isDark = next === "dark";
    toggle.setAttribute("aria-checked", String(isDark));
    toggle.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode"
    );
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
    storeTheme(next);
  }

  function enableThemeTransitions() {
    requestAnimationFrame(function () {
      document.documentElement.classList.add("theme-ready");
    });
  }

  function initTheme() {
    applyTheme(getInitialTheme());
    enableThemeTransitions();

    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", toggleTheme);
  }

  function initNav() {
    const toggle = document.getElementById("menu-toggle");
    const nav = document.getElementById("primary-nav");
    const links = nav ? nav.querySelectorAll('a[href^="#"]') : [];

    function closeMenu() {
      if (!nav || !toggle) return;
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation menu");
    }

    function openMenu() {
      if (!nav || !toggle) return;
      nav.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close navigation menu");
    }

    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        if (nav.classList.contains("is-open")) closeMenu();
        else openMenu();
      });
    }

    links.forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });

    observeActiveSection(links);
  }

  function observeActiveSection(links) {
    const targets = sections
      .map(function (id) {
        return document.getElementById(id);
      })
      .filter(Boolean);

    if (!targets.length || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (link) {
            const isActive = link.getAttribute("href") === "#" + entry.target.id;
            link.classList.toggle("active", isActive);
          });
        });
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0.1 }
    );

    targets.forEach(function (section) {
      observer.observe(section);
    });
  }

  function initContactForm() {
    const form = document.getElementById("contact-form");
    const status = document.getElementById("form-status");
    if (!form || !status) return;

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const name = document.getElementById("contact-name").value.trim();
      const email = document.getElementById("contact-email").value.trim();
      const message = document.getElementById("contact-message").value.trim();

      if (!name || !email || !message) {
        status.textContent = "Please fill in name, email, and message.";
        return;
      }

      // TODO: replace EMAIL = [anweshanayak654@gmail.coml]
      const subject = encodeURIComponent("Portfolio message from " + name);
      const body = encodeURIComponent(message + "\n\nFrom: " + name + " <" + email + ">");
      window.location.href =
        "mailto:anweshanayak654@gmail.coml?subject=" + subject + "&body=" + body;
      status.textContent = "Opening your email app…";
    });
  }

  function getProjects() {
    return Array.isArray(window.projects) ? window.projects : [];
  }

  function uniqueTags(projects) {
    const set = {};
    projects.forEach(function (project) {
      (project.tags || []).forEach(function (tag) {
        set[tag] = true;
      });
    });
    return Object.keys(set).sort();
  }

  function initProjects() {
    const grid = document.getElementById("project-grid");
    const filters = document.getElementById("project-filters");
    const search = document.getElementById("project-search");
    const clearBtn = document.getElementById("clear-search-btn");
    const status = document.getElementById("filter-status");
    if (!grid || !filters) return;

    const projects = getProjects();
    let activeTag = "All";
    let query = "";

    renderFilters(filters, uniqueTags(projects), function (tag) {
      activeTag = tag;
      updateFilterPressed(filters, activeTag);
      render();
    });
    updateFilterPressed(filters, activeTag);

    function updateClearButton() {
      if (!clearBtn) return;
      clearBtn.hidden = !query;
    }

    function clearSearch() {
      if (search) {
        search.value = "";
        search.focus();
      }
      query = "";
      updateClearButton();
      render();
    }

    function resetAllFilters() {
      if (search) search.value = "";
      query = "";
      activeTag = "All";
      updateClearButton();
      updateFilterPressed(filters, activeTag);
      render();
    }

    if (search) {
      search.addEventListener("input", function () {
        query = search.value.trim().toLowerCase();
        updateClearButton();
        render();
      });

      search.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && query) {
          e.preventDefault();
          clearSearch();
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        clearSearch();
      });
    }

    function render() {
      const visible = projects.filter(function (project) {
        const haystack = (
          project.title +
          " " +
          project.description +
          " " +
          (project.tags || []).join(" ")
        ).toLowerCase();
        const matchesQuery = !query || haystack.indexOf(query) !== -1;
        const matchesTag = activeTag === "All" || (project.tags || []).indexOf(activeTag) !== -1;
        return matchesQuery && matchesTag;
      });

      grid.replaceChildren();

      if (visible.length === 0) {
        grid.appendChild(createEmptyState(query, activeTag, resetAllFilters));
        if (status) {
          status.textContent = "No projects found matching your criteria.";
        }
      } else {
        visible.forEach(function (project) {
          grid.appendChild(createCard(project));
        });

        if (status) {
          status.textContent =
            visible.length +
            " project" +
            (visible.length === 1 ? "" : "s") +
            (activeTag !== "All" ? " tagged \"" + activeTag + "\"" : "") +
            (query ? " matching \"" + query + "\"" : "");
        }
      }
    }

    render();
  }

  function createEmptyState(query, activeTag, onReset) {
    const empty = document.createElement("div");
    empty.className = "scrapbook-empty-state paper-cream";

    const tape = document.createElement("div");
    tape.className = "washi-tape-strip washi-blush-pink";
    tape.setAttribute("aria-hidden", "true");

    const icon = document.createElement("span");
    icon.className = "empty-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✎";

    const title = document.createElement("h3");
    title.className = "empty-title";
    title.textContent = "No scrapbook entries found";

    const desc = document.createElement("p");
    desc.className = "empty-desc";
    let descText = "We couldn't find any projects matching your criteria";
    if (query) descText += " for \"" + query + "\"";
    if (activeTag !== "All") descText += " with tag \"" + activeTag + "\"";
    descText += ". Try another keyword or clear your filters to view all entries.";
    desc.textContent = descText;

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "scrapbook-main-btn reset-filters-btn";
    resetBtn.textContent = "Clear Search & Filters";
    resetBtn.addEventListener("click", onReset);

    empty.append(tape, icon, title, desc, resetBtn);
    return empty;
  }

  function renderFilters(container, tags, onSelect) {
    container.replaceChildren();
    ["All"].concat(tags).forEach(function (tag) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.textContent = tag;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", onSelect.bind(null, tag));
      container.appendChild(button);
    });
  }

  function updateFilterPressed(container, activeTag) {
    container.querySelectorAll(".filter-chip").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.textContent === activeTag));
    });
  }

  function createCard(project) {
    const article = document.createElement("article");
    const paperColor = project.paperColor || "cream";
    article.className = "project-card scrapbook-sheet paper-" + paperColor;

    // Top washi tape
    const washi = document.createElement("div");
    washi.className = "washi-tape-strip " + (project.tapeColor || "blush-tape");
    article.appendChild(washi);

    // Header with stamp number and handwritten annotation
    const metaRow = document.createElement("div");
    metaRow.className = "sheet-meta-row";

    const stamp = document.createElement("span");
    stamp.className = "vintage-stamp-label";
    stamp.textContent = project.stampNumber || "ENTRY";

    const annotation = document.createElement("span");
    annotation.className = "handwritten-annotation";
    annotation.textContent = project.annotation || "✦ personal build";

    metaRow.appendChild(stamp);
    metaRow.appendChild(annotation);
    article.appendChild(metaRow);

    // Title
    const title = document.createElement("h3");
    title.className = "sheet-title";
    title.textContent = project.title;
    article.appendChild(title);

    // Description
    const description = document.createElement("p");
    description.className = "sheet-description";
    description.textContent = project.description;
    article.appendChild(description);

    // Tags
    const tags = document.createElement("div");
    tags.className = "card-tags";
    (project.tags || []).forEach(function (tag) {
      const pill = document.createElement("span");
      pill.className = "tag paper-tag";
      pill.textContent = tag;
      tags.appendChild(pill);
    });
    article.appendChild(tags);

    // Links container - functional "View on GitHub", optional Live Demo only if verified URL
    const links = document.createElement("div");
    links.className = "card-links sheet-actions";
    if (project.githubUrl) {
      const ghBtn = createScrapbookLink(
        project.githubUrl,
        "View on GitHub",
        "github",
        "View " + project.title + " on GitHub"
      );
      links.appendChild(ghBtn);
    }
    if (project.liveUrl && project.liveUrl.trim().length > 0) {
      const liveBtn = createScrapbookLink(
        project.liveUrl,
        "Live Demo",
        "external",
        "Live demo for " + project.title
      );
      liveBtn.classList.add("scrapbook-btn--accent");
      links.appendChild(liveBtn);
    }
    article.appendChild(links);

    // Corner decorative fold
    const corner = document.createElement("div");
    corner.className = "folded-corner";
    article.appendChild(corner);

    return article;
  }

  function createScrapbookLink(href, labelText, kind, ariaLabel) {
    const link = document.createElement("a");
    link.className = "scrapbook-link-btn";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", ariaLabel);

    const spanIcon = document.createElement("span");
    spanIcon.className = "icon";
    spanIcon.setAttribute("aria-hidden", "true");
    spanIcon.appendChild(createSvg(kind));

    const text = document.createElement("span");
    text.className = "btn-text";
    text.textContent = labelText;

    link.appendChild(spanIcon);
    link.appendChild(text);
    return link;
  }

  function createIconLink(href, label, kind) {
    const link = document.createElement("a");
    link.className = "icon-btn";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", label);

    const span = document.createElement("span");
    span.className = "icon";
    span.setAttribute("aria-hidden", "true");
    span.appendChild(createSvg(kind));
    link.appendChild(span);
    return link;
  }

  function createSvg(kind) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");

    if (kind === "github") {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute(
        "d",
        "M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.1-1.5 6.1-6.6A5.1 5.1 0 0 0 19 4.8 4.8 4.8 0 0 0 18.9 1S17.7.7 15 2.6a13.4 13.4 0 0 0-6 0C6.3.7 5.1 1 5.1 1A4.8 4.8 0 0 0 5 4.8 5.1 5.1 0 0 0 3.8 8.9c0 5.1 3.1 6.3 6.1 6.6a3.4 3.4 0 0 0-.9 2.6V21"
      );
      svg.appendChild(path);
    } else {
      const p1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p1.setAttribute("d", "M14 4h6v6");
      const p2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p2.setAttribute("d", "M10 14 20 4");
      const p3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p3.setAttribute("d", "M20 14v6H4V4h6");
      svg.append(p1, p2, p3);
    }
    return svg;
  }
})();
