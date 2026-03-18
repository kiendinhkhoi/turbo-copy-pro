// Turbo Copy Pro - Renderer
(function () {
  "use strict";

  var api = window.electronAPI;
  if (!api) {
    document.body.innerHTML = "<h1 style='color:red;padding:40px'>ERROR: electronAPI not loaded</h1>";
    return;
  }

  // State
  var sourceFolders = [];
  var destFolders = [];
  var scannedFiles = [];
  var isCopying = false;

  // DOM
  var sourceList = document.getElementById("source-list");
  var destList = document.getElementById("dest-list");
  var sourceCount = document.getElementById("source-count");
  var destCount = document.getElementById("dest-count");
  var patternsInput = document.getElementById("patterns-input");
  var btnScan = document.getElementById("btn-scan");
  var btnCopy = document.getElementById("btn-copy");
  var btnClear = document.getElementById("btn-clear");
  var selectAll = document.getElementById("select-all");
  var fileTable = document.getElementById("file-table");
  var fileTbody = document.getElementById("file-tbody");
  var tableEmpty = document.getElementById("table-empty");
  var statsText = document.getElementById("stats-text");
  var toggleRecursive = document.getElementById("toggle-recursive");
  var toggleOverwrite = document.getElementById("toggle-overwrite");
  var btnAbort = document.getElementById("btn-abort");

  // Helpers
  function escapeHtml(s) {
    var d = document.createElement("div");
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function shortenPath(p) {
    var parts = p.replace(/\\/g, "/").split("/");
    if (parts.length <= 3) return p;
    return parts[0] + "/\u2026/" + parts.slice(-2).join("/");
  }

  function formatSize(bytes) {
    if (bytes === 0) return "0 B";
    var units = ["B", "KB", "MB", "GB", "TB"];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // Folder items
  function createFolderItem(folderPath, type) {
    var item = document.createElement("div");
    item.className = "folder-item";

    var iconDiv = document.createElement("div");
    iconDiv.className = "folder-icon" + (type === "dest" ? " dest" : "");
    if (type === "dest") {
      iconDiv.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    } else {
      iconDiv.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
    }

    var pathSpan = document.createElement("span");
    pathSpan.className = "folder-path";
    pathSpan.title = folderPath;
    pathSpan.textContent = shortenPath(folderPath);

    var removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove";
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener("click", function () {
      item.style.opacity = "0";
      item.style.transform = "translateX(-10px)";
      item.style.transition = "all 0.2s ease";
      setTimeout(function () {
        item.remove();
        if (type === "source") {
          sourceFolders = sourceFolders.filter(function (f) { return f !== folderPath; });
          sourceCount.textContent = sourceFolders.length;
        } else {
          destFolders = destFolders.filter(function (f) { return f !== folderPath; });
          destCount.textContent = destFolders.length;
        }
      }, 200);
    });

    item.appendChild(iconDiv);
    item.appendChild(pathSpan);
    item.appendChild(removeBtn);
    return item;
  }

  // Saved folders (localStorage)
  var savedSourceFolders = JSON.parse(localStorage.getItem("turbo-saved-sources") || "[]");
  var savedDestFolders = JSON.parse(localStorage.getItem("turbo-saved-dests") || "[]");

  // Custom dropdown logic
  function initDropdown(dropdownEl, savedFolders, storageKey, type) {
    var trigger = dropdownEl.querySelector(".dropdown-trigger");
    var triggerText = dropdownEl.querySelector(".dropdown-trigger-text");
    var panel = dropdownEl.querySelector(".dropdown-panel");
    var list = dropdownEl.querySelector(".dropdown-list");
    var emptyMsg = dropdownEl.querySelector(".dropdown-empty");
    var defaultText = triggerText.textContent;

    function renderList() {
      list.innerHTML = "";
      if (savedFolders.length === 0) {
        emptyMsg.classList.add("visible");
      } else {
        emptyMsg.classList.remove("visible");
        savedFolders.forEach(function (folder, idx) {
          var item = document.createElement("div");
          item.className = "dropdown-item";

          var icon = document.createElement("div");
          icon.className = "dropdown-item-icon";
          icon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';

          var pathSpan = document.createElement("span");
          pathSpan.className = "dropdown-item-path";
          pathSpan.textContent = folder;
          pathSpan.title = folder;

          var fullPath = document.createElement("div");
          fullPath.className = "dropdown-item-full";
          fullPath.textContent = folder;

          var removeBtn = document.createElement("button");
          removeBtn.className = "dropdown-item-remove";
          removeBtn.innerHTML = "&times;";
          removeBtn.title = "Remove from saved";
          removeBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            savedFolders.splice(idx, 1);
            localStorage.setItem(storageKey, JSON.stringify(savedFolders));
            renderList();
          });

          item.appendChild(icon);
          item.appendChild(pathSpan);
          item.appendChild(fullPath);
          item.appendChild(removeBtn);

          item.addEventListener("click", function () {
            addFolderToList(folder, type);
            closeDropdown();
          });

          list.appendChild(item);
        });
      }
    }

    function closeDropdown() {
      dropdownEl.classList.remove("open");
    }

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      // Close any other open dropdowns
      document.querySelectorAll(".custom-dropdown.open").forEach(function (d) {
        if (d !== dropdownEl) d.classList.remove("open");
      });
      dropdownEl.classList.toggle("open");
      if (dropdownEl.classList.contains("open")) renderList();
    });

    return { renderList: renderList, closeDropdown: closeDropdown };
  }

  var sourceDropdown = initDropdown(
    document.getElementById("source-dropdown"),
    savedSourceFolders,
    "turbo-saved-sources",
    "source"
  );
  var destDropdown = initDropdown(
    document.getElementById("dest-dropdown"),
    savedDestFolders,
    "turbo-saved-dests",
    "dest"
  );

  // Close dropdowns when clicking outside
  document.addEventListener("click", function () {
    document.querySelectorAll(".custom-dropdown.open").forEach(function (d) {
      d.classList.remove("open");
    });
  });

  function addFolderToList(folder, type) {
    if (type === "source") {
      if (sourceFolders.indexOf(folder) === -1) {
        sourceFolders.push(folder);
        sourceList.appendChild(createFolderItem(folder, "source"));
        sourceCount.textContent = sourceFolders.length;
      }
    } else {
      if (destFolders.indexOf(folder) === -1) {
        destFolders.push(folder);
        destList.appendChild(createFolderItem(folder, "dest"));
        destCount.textContent = destFolders.length;
      }
    }
  }

  function saveFolderToStorage(folder, type) {
    var saved = type === "source" ? savedSourceFolders : savedDestFolders;
    var key = type === "source" ? "turbo-saved-sources" : "turbo-saved-dests";
    if (saved.indexOf(folder) === -1) {
      saved.push(folder);
      localStorage.setItem(key, JSON.stringify(saved));
    }
  }

  // Browse Source button
  document.getElementById("btn-browse-source").addEventListener("click", function () {
    api.selectFolder().then(function (folder) {
      if (folder) {
        saveFolderToStorage(folder, "source");
        addFolderToList(folder, "source");
      }
    });
  });

  // Browse Destination button
  document.getElementById("btn-browse-dest").addEventListener("click", function () {
    api.selectFolder().then(function (folder) {
      if (folder) {
        saveFolderToStorage(folder, "dest");
        addFolderToList(folder, "dest");
      }
    });
  });

  // Scan Files
  btnScan.addEventListener("click", function () {
    var patterns = patternsInput.value.trim();
    if (sourceFolders.length === 0) return;
    if (!patterns) return;
    btnScan.disabled = true;
    btnScan.classList.add("btn-scanning");
    var origText = "Preview";
    btnScan.lastChild.textContent = " Scanning\u2026";

    api.scanFiles({ sourceFolders: sourceFolders, patterns: patterns, recursive: toggleRecursive.checked }).then(function (files) {
      scannedFiles = files;
      renderTable();
      updateStats();
    }).catch(function (err) {
      console.error("Scan failed:", err.message);
    }).finally(function () {
      btnScan.disabled = false;
      btnScan.classList.remove("btn-scanning");
      btnScan.lastChild.textContent = " " + origText;
    });
  });

  // Render Table
  function renderTable() {
    fileTbody.innerHTML = "";

    if (scannedFiles.length === 0) {
      fileTable.style.display = "none";
      tableEmpty.style.display = "flex";
      btnCopy.disabled = true;
      return;
    }

    tableEmpty.style.display = "none";
    fileTable.style.display = "table";
    btnCopy.disabled = false;

    scannedFiles.forEach(function (file, index) {
      var tr = document.createElement("tr");
      tr.setAttribute("data-file-id", file.id);
      tr.style.animationDelay = (index * 30) + "ms";

      var tdCheck = document.createElement("td");
      tdCheck.className = "td-check";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.setAttribute("data-id", file.id);
      tdCheck.appendChild(cb);

      var tdName = document.createElement("td");
      tdName.className = "td-filename";
      tdName.textContent = file.name;

      // Rename cell
      var tdRename = document.createElement("td");
      tdRename.className = "td-rename";
      if (!file.renameTo) file.renameTo = file.name;
      var renameLabel = document.createElement("span");
      renameLabel.className = "rename-label";
      renameLabel.textContent = file.name;
      var renameBtn = document.createElement("button");
      renameBtn.className = "rename-btn";
      renameBtn.title = "Rename";
      renameBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
      var renameInput = document.createElement("input");
      renameInput.type = "text";
      renameInput.className = "rename-input";
      renameInput.value = file.renameTo;
      renameInput.style.display = "none";
      var saveBtn = document.createElement("button");
      saveBtn.className = "rename-btn rename-save-btn";
      saveBtn.title = "Save";
      saveBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      saveBtn.style.display = "none";
      renameBtn.addEventListener("click", function () {
        renameLabel.style.display = "none";
        renameBtn.style.display = "none";
        renameInput.style.display = "";
        saveBtn.style.display = "";
        renameInput.focus();
        renameInput.select();
      });
      function commitRename() {
        var val = renameInput.value.trim();
        if (val) {
          file.renameTo = val;
          renameLabel.textContent = val;
        }
        renameInput.style.display = "none";
        saveBtn.style.display = "none";
        renameLabel.style.display = "";
        renameBtn.style.display = "";
      }
      saveBtn.addEventListener("click", commitRename);
      renameInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") commitRename();
        if (e.key === "Escape") {
          renameInput.value = file.renameTo;
          commitRename();
        }
      });
      tdRename.appendChild(renameLabel);
      tdRename.appendChild(renameBtn);
      tdRename.appendChild(renameInput);
      tdRename.appendChild(saveBtn);

      var tdSource = document.createElement("td");
      tdSource.className = "td-source";
      tdSource.textContent = shortenPath(file.source);
      tdSource.title = file.source;

      var tdSize = document.createElement("td");
      tdSize.className = "td-size";
      tdSize.textContent = formatSize(file.size);

      var tdMod = document.createElement("td");
      tdMod.className = "td-modified";
      tdMod.textContent = formatDate(file.modified);

      var tdStatus = document.createElement("td");
      tdStatus.className = "td-status";
      tdStatus.innerHTML = statusBadge(file.status);

      var tdProgress = document.createElement("td");
      tdProgress.className = "td-progress";
      tdProgress.innerHTML = '<div class="row-progress-wrap"><div class="row-progress-track"><div class="row-progress-bar" data-bar-id="' + file.id + '"></div></div><span class="row-progress-pct" data-pct-id="' + file.id + '">—</span></div>';

      tr.appendChild(tdCheck);
      tr.appendChild(tdName);
      tr.appendChild(tdRename);
      tr.appendChild(tdSource);
      tr.appendChild(tdSize);
      tr.appendChild(tdMod);
      tr.appendChild(tdProgress);
      tr.appendChild(tdStatus);
      fileTbody.appendChild(tr);
    });
  }

  function statusBadge(status) {
    var cls = "status-badge status-" + status;
    var label = status.charAt(0).toUpperCase() + status.slice(1);
    return '<span class="' + cls + '"><span class="status-dot"></span>' + escapeHtml(label) + '</span>';
  }

  function updateRowStatus(fileId, status) {
    var row = fileTbody.querySelector('tr[data-file-id="' + fileId + '"]');
    if (!row) return;
    var cell = row.querySelector(".td-status");
    cell.innerHTML = statusBadge(status);
  }

  function updateRowProgress(fileId, pct, status) {
    var bar = fileTbody.querySelector('.row-progress-bar[data-bar-id="' + fileId + '"]');
    var label = fileTbody.querySelector('.row-progress-pct[data-pct-id="' + fileId + '"]');
    if (!bar || !label) return;
    bar.style.width = pct + "%";
    label.textContent = pct + "%";
    bar.classList.remove("bar-complete", "bar-error");
    if (status === "copied" && pct === 100) bar.classList.add("bar-complete");
    if (status === "error") bar.classList.add("bar-error");
  }

  function updateStats() {
    var total = scannedFiles.length;
    var copied = scannedFiles.filter(function (f) { return f.status === "copied"; }).length;
    var errors = scannedFiles.filter(function (f) { return f.status === "error"; }).length;
    var span = statsText.querySelector("span");
    if (total === 0) {
      span.textContent = "No files scanned";
    } else {
      var aborted = scannedFiles.filter(function (f) { return f.status === "aborted"; }).length;
      var s = total + " file" + (total > 1 ? "s" : "");
      if (copied > 0) s += " \u00b7 " + copied + " copied";
      if (errors > 0) s += " \u00b7 " + errors + " failed";
      if (aborted > 0) s += " \u00b7 " + aborted + " aborted";
      span.textContent = s;
    }
  }

  function getSelectedFiles() {
    var checks = fileTbody.querySelectorAll('input[type="checkbox"]:checked');
    var ids = [];
    checks.forEach(function (cb) { ids.push(Number(cb.getAttribute("data-id"))); });
    return scannedFiles.filter(function (f) { return ids.indexOf(f.id) !== -1; });
  }

  // Copy Files
  btnCopy.addEventListener("click", function () {
    if (isCopying) return;
    if (destFolders.length === 0) return;
    var selectedFiles = getSelectedFiles();
    if (selectedFiles.length === 0) return;

    isCopying = true;
    btnCopy.disabled = true;
    btnCopy.style.display = "none";
    btnAbort.style.display = "";
    btnScan.disabled = true;

    // Track per-file dest completions
    var fileDestCounts = {};
    var totalDests = destFolders.length;
    selectedFiles.forEach(function (f) {
      fileDestCounts[f.id] = 0;
      f.status = "copying";
      updateRowStatus(f.id, "copying");
      updateRowProgress(f.id, 0, "copying");
      // Reset dest-done counter so progress doesn't accumulate across clicks
      var bar = fileTbody.querySelector('.row-progress-bar[data-bar-id="' + f.id + '"]');
      if (bar) bar.setAttribute("data-dest-done", "0");
    });

    // Reset overall progress
    var overallBar = document.getElementById("overall-progress-bar");
    var overallLabel = document.getElementById("overall-progress-label");
    if (overallBar) overallBar.style.width = "0%";
    if (overallLabel) overallLabel.textContent = "0%";

    api.copyFiles({ files: selectedFiles, destFolders: destFolders, overwrite: toggleOverwrite.checked, recursive: toggleRecursive.checked }).then(function () {
    }).catch(function (err) {
      console.error("Copy failed:", err.message);
    }).finally(function () {
      isCopying = false;
      btnCopy.disabled = false;
      btnCopy.style.display = "";
      btnAbort.style.display = "none";
      btnScan.disabled = false;
      updateStats();
    });
  });

  // Progress listener
  api.onCopyProgress(function (data) {
    var file = scannedFiles.find(function (f) { return f.id === data.fileId; });
    if (file) {
      // Only upgrade status: copying -> copied/skipped/error; don't downgrade copied to skipped
      if (file.status !== "copied" || data.status === "error") {
        file.status = data.status;
      }
      updateRowStatus(data.fileId, file.status);
      // Calculate per-file progress
      var row = fileTbody.querySelector('tr[data-file-id="' + data.fileId + '"]');
      if (row) {
        var bar = row.querySelector(".row-progress-bar");
        if (bar) {
          var current = parseInt(bar.getAttribute("data-dest-done") || "0", 10) + 1;
          bar.setAttribute("data-dest-done", current);
          var pct = Math.round((current / destFolders.length) * 100);
          updateRowProgress(data.fileId, pct, file.status);
        }
      }
      // Update overall progress bar
      if (data.completed != null && data.total != null && data.total > 0) {
        var overallPct = Math.round((data.completed / data.total) * 100);
        var overallBar = document.getElementById("overall-progress-bar");
        var overallLabel = document.getElementById("overall-progress-label");
        if (overallBar) overallBar.style.width = overallPct + "%";
        if (overallLabel) overallLabel.textContent = overallPct + "%";
      }
      updateStats();
    }
  });

  // Abort
  btnAbort.addEventListener("click", function () {
    api.abortCopy();
    btnAbort.disabled = true;
    btnAbort.lastChild.textContent = " Aborting\u2026";
  });

  // Listen for abort confirmation from main process
  api.onCopyAborted(function () {
    // Mark remaining "copying" files as aborted
    scannedFiles.forEach(function (f) {
      if (f.status === "copying") {
        f.status = "aborted";
        updateRowStatus(f.id, "aborted");
      }
    });
    btnAbort.disabled = false;
    btnAbort.lastChild.textContent = " Abort";
    updateStats();
  });

  // Clear
  btnClear.addEventListener("click", function () {
    scannedFiles = [];
    renderTable();
    updateStats();
  });

  // Select All
  selectAll.addEventListener("change", function (e) {
    var checks = fileTbody.querySelectorAll('input[type="checkbox"]');
    checks.forEach(function (cb) { cb.checked = e.target.checked; });
  });

})();
