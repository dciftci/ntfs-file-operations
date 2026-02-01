const FILE_OPS = [
  {
    id: "create-file",
    name: "Create file",
    useCase: "Payload drop in Temp, tool output (dump/log), staging files",
    bestArtifacts: "$J + $MFT",
    conclusion: "File creation activity happened around X; $MFT confirms file record + metadata",
    commands: "C:\\Users\\deniz\\Desktop>echo @echo off > %USERPROFILE%\\Desktop\\deniz.bat\nC:\\Users\\deniz\\Desktop>echo [TIME] %DATE% %TIME%\n[TIME] Sat 01/31/2026 14:52:18.07",
    mft: [
      "No MFT records found for this operation."
    ],
    usn: [
      "<strong>FileCreate:</strong> NTFS created the file entry (metadata only, no data yet).",
      "<strong>DataExtend | FileCreate:</strong> Data was written to the file while it was being created.",
      "<strong>DataExtend | FileCreate | Close:</strong> Final write finished and the file handle was closed."
    ],
    log: [
      "<strong>File Creation:</strong> NTFS initialized the file record segment in the MFT.",
      "<strong>Writing Content of Resident File:</strong> File data was written as resident data inside the MFT."
    ],
    usnImage: "images/filecreate-j.png",
    logImage: "images/filecreate-logfile.png"
  },
  {
    id: "write-modify",
    name: "Write / Modify file",
    useCase: "Logging, config edits, building an archive gradually",
    bestArtifacts: "$J + $LogFile, validate with $MFT",
    conclusion: "Content was written/extended; $LogFile can show write sequencing, $J shows high-level change",
    commands: "C:\\Users\\deniz\\Desktop>echo log entry %DATE% %TIME%>>\"%USERPROFILE%\\Desktop\\deniz.bat\"\nC:\\Users\\deniz\\Desktop>echo [TIME] %DATE% %TIME%\n[TIME] Sat 01/31/2026 14:53:23.32",
    mft: [
      "No MFT records found for this operation."
    ],
    usn: [
      "<strong>DataExtend:</strong> Additional data was written to an existing file (file size increased).",
      "<strong>DataExtend | Close:</strong> Final data write completed and the file handle was closed."
    ],
    log: [
      "<strong>$LogFile – Updating Modified Time:</strong> NTFS updated the file's ModifiedTime from 14:52:18 to 14:53:23 due to the write operation (Update Resident Value)."
    ],
    usnImage: "images/filewrite-j.png",
    logImage: "images/filewrite-logfile.png"
  },
  {
    id: "overwrite",
    name: "Overwrite file",
    useCase: "\"Clean-up\" by overwriting logs/artifacts without deleting",
    bestArtifacts: "$J + $LogFile",
    conclusion: "Strong evidence of content replacement (vs just metadata change)",
    commands: "C:\\Users\\deniz\\Desktop>echo overwritten>\"%USERPROFILE%\\Desktop\\deniz.bat\"\nC:\\Users\\deniz\\Desktop>echo [TIME] %DATE% %TIME%\n[TIME] Sat 01/31/2026 14:54:45.74",
    mft: [
      "No MFT records found for this operation."
    ],
    usn: [
      "<strong>DataTruncation:</strong> File size was reduced or reset (existing content cleared).",
      "<strong>DataExtend | DataTruncation:</strong> New data was written after truncation (overwrite started).",
      "<strong>DataExtend | DataTruncation | Close:</strong> Overwrite completed and the file handle was closed."
    ],
    log: [
      "<strong>$LogFile – Updating Modified Time:</strong> NTFS updated ModifiedTime from 14:53:23 to 14:54:45 as a result of the overwrite operation (Update Resident Value)."
    ],
    usnImage: "images/fileoverwrite-j.png",
    logImage: "images/fileoverwrite-logfile.png"
  },
  {
    id: "truncate",
    name: "Truncate file",
    useCase: "Clearing a log while keeping the file name",
    bestArtifacts: "$J + $MFT (sometimes $LogFile)",
    conclusion: "File size reduction occurred; common \"log wiped\" pattern",
    commands: "# It zeros out the contents of the file.\nC:\\Users\\deniz\\Desktop>fsutil file setZeroData offset=0 length=999999999 \"%USERPROFILE%\\Desktop\\deniz.bat\"\n\nC:\\Users\\deniz\\Desktop>echo [TIME] %DATE% %TIME%\n[TIME] Sat 01/31/2026 14:55:51.06",
    mft: [
      "No MFT records found for this operation."
    ],
    usn: [
      "<strong>DataOverwrite:</strong> Existing file content was overwritten without extending the file size.",
      "<strong>DataOverwrite | Close:</strong> Overwrite completed and the file handle was closed."
    ],
    log: [
      "<strong>$LogFile – Updating Modified Time:</strong> ModifiedTime was updated from 14:54:45 to 14:55:51 due to the truncate/overwrite operation (Update Resident Value)."
    ],
    usnImage: "images/truncate-j.png",
    logImage: "images/truncate-logfile.png"
  },
  {
    id: "rename",
    name: "Rename file",
    useCase: "lsass.dmp → system.dat to hide; extension swaps",
    bestArtifacts: "$J + $MFT",
    conclusion: "Often recover old+new names (via $J), confirm final state (via $MFT)",
    commands: "C:\\Users\\deniz\\Desktop>ren \"%USERPROFILE%\\Desktop\\deniz.bat\" system.dat\n\nC:\\Users\\deniz\\Desktop>echo [TIME] %DATE% %TIME%\n[TIME] Sat 01/31/2026 14:56:52.98",
    mft: [
      "No MFT records found for this operation."
    ],
    usn: [
      "<strong>RenameNewName:</strong> The file was renamed to system.dat.",
      "<strong>RenameNewName | Close:</strong> Rename operation completed and the handle was closed."
    ],
    log: [
      "<strong>Renaming File:</strong> NTFS updated the $FILE_NAME attribute (deniz.bat → system.dat).",
      "<strong>Updating MFTModifiedTime:</strong> MFTModifiedTime was updated to 2026-01-31 14:56:52 (Update Resident Value)."
    ],
    usnImage: "images/filerename-j.png",
    logImage: "images/filerename-logfile.png"
  },
  {
    id: "move-same-volume",
    name: "Move file",
    useCase: "Moving payload from obvious folder to obscure location",
    bestArtifacts: "$J + $MFT",
    conclusion: "Path relationship changed; great for timeline chaining with rename/create",
    commands: "C:\\Users\\deniz\\Desktop>move \"%USERPROFILE%\\Desktop\\system.dat\" \"%USERPROFILE%\\Desktop\\.cache.dat\"\n        1 file(s) moved.\n\nC:\\Users\\deniz\\Desktop>echo [TIME] %DATE% %TIME%\n[TIME] Sat 01/31/2026 14:57:54.19",
    mft: [
      "Same Entry Number (152529) confirms this is not a new file, only a rename.",
      "CreatedTime stays 2026-01-31 13:52:18, proving the file was originally created earlier."
    ],
    usn: [
      "<strong>RenameOldName:</strong> The old filename (system.dat) was removed from the directory index.",
      "<strong>RenameNewName:</strong> The same MFT entry was linked with the new name (.cache.dat).",
      "<strong>RenameNewName | Close:</strong> Rename completed and the handle was closed."
    ],
    log: [
      "<strong>Updating MFTModifiedTime:</strong> MFTModifiedTime updated to 14:57:52 due to $FILE_NAME attribute change."
    ],
    usnImage: "images/filemove-J.png",
    logImage: "images/filemove-logfile.png"
  },
  {
    id: "copy",
    name: "Copy file",
    useCase: "Toolkit copied into another directory",
    bestArtifacts: "$J + $MFT",
    conclusion: "Copy usually appears as create+write at destination; prove by correlation (source + destination timing)",
    mft: [
      "No MFT records found for this operation."
    ],
    usn: [
      "Create event at destination; source file may show READ operations.",
      "Multiple USN records if large file (chunked copy)."
    ],
    log: [
      "Transaction records for destination file creation and data writes."
    ]
  },
  {
    id: "delete",
    name: "Delete file",
    useCase: "Post-execution cleanup",
    bestArtifacts: "$J + $MFT",
    conclusion: "Delete event time (if still in $J) + $MFT record marked unused",
    mft: [
      "No MFT records found for this operation."
    ],
    usn: [
      "Common reason: FILE_DELETE (and sometimes CLOSE)."
    ],
    log: [
      "Transactional steps around unlinking/metadata update may appear."
    ]
  },
  {
    id: "secure-delete",
    name: "Secure-delete file",
    useCase: "Anti-forensics (multiple overwrites)",
    bestArtifacts: "$LogFile (+ $J when present)",
    conclusion: "Possible overwrite-heavy patterns; confirmation often needs free-space analysis/other telemetry",
    mft: [
      "No MFT records found for this operation."
    ],
    usn: [
      "Multiple DATA_OVERWRITE events in short time period.",
      "May also show delete after overwrite sequence."
    ],
    log: [
      "Multiple overwrite transactions visible if $LogFile retention allows.",
      "Strongest indicator of intentional content destruction."
    ]
  },
  {
    id: "timestomp",
    name: "Timestomp file",
    useCase: "Make file look old/new to mislead timeline",
    bestArtifacts: "$J / $LogFile vs $MFT",
    conclusion: "$MFT timestamps alone can lie; $J/$LogFile can show \"real activity time\"",
    mft: [
      "No MFT records found for this operation."
    ],
    usn: [
      "$J timestamps reflect real activity time (not easily manipulated without admin privileges).",
      "Correlate $J timing with $MFT to detect discrepancies."
    ],
    log: [
      "$LogFile transaction timestamps show real system time of operations.",
      "Compare with $MFT to identify timestamp manipulation."
    ]
  },
  {
    id: "metadata-only",
    name: "Metadata-only change file",
    useCase: "Hide file (hidden/system), restrict access",
    bestArtifacts: "$MFT + $J",
    conclusion: "Attribute/ACL changes can appear without content writes—useful for stealth/persistence narratives",
    mft: [
      "No MFT records found for this operation."
    ],
    usn: [
      "BASIC_INFO_CHANGE reason typically present.",
      "May also show SECURITY_CHANGE if ACL modified."
    ],
    log: [
      "Transactional metadata updates visible if attributes/permissions changed."
    ]
  },
  {
    id: "ads-write",
    name: "ADS write file",
    useCase: "Hide payload in legit.txt:evil.bin",
    bestArtifacts: "$MFT + $J (sometimes $LogFile)",
    conclusion: "Evidence of stream presence/changes; good for \"hidden content\" staging",
    mft: [
      "No MFT records found for this operation."
    ],
    usn: [
      "Stream creation/write may generate USN records with stream name.",
      "FILE_CREATE or DATA_EXTEND with stream context."
    ],
    log: [
      "Transactional records for stream attribute creation and data writes."
    ]
  }
];

const FOLDER_OPS = [];

let currentType = "FILE"; // "FILE", "FOLDER", or "LNK"
let activeId = null;

let elOpList, elSearch, elTypeToggle, elEmpty, elDetails, elTitle, elUseCase, elCommands;
let panels;

function getCurrentOps() {
  if (currentType === "FILE") return FILE_OPS;
  if (currentType === "FOLDER") return FOLDER_OPS;
  return FILE_OPS;
}

function renderList(filter = "") {
  if (!elOpList) return;
  elOpList.innerHTML = "";
  const q = filter.trim().toLowerCase();
  const ops = getCurrentOps();
  const items = ops.filter(o =>
    !q ||
    o.name.toLowerCase().includes(q) ||
    o.useCase.toLowerCase().includes(q)
  );

  items.forEach(op => {
    const li = document.createElement("li");
    li.className = "op-item" + (op.id === activeId ? " active" : "");
    li.innerHTML = `
        <div class="op-header">
          <div class="op-name">${op.name}</div>
        </div>
      <div class="op-desc">${op.useCase}</div>
    `;
    li.onclick = () => showDetails(op.id);
    elOpList.appendChild(li);
  });
}

function listToHtml(title, arr, screenshot = null, altText = "Screenshot") {
  if (!arr || arr.length === 0) return "";
  
  let html = `<h3>${title}</h3>`;
  
  // Add screenshot if available
  if (screenshot) {
    html += `<div class="screenshot-container"><img src="${screenshot}" alt="${altText}" class="screenshot" /></div>`;
  }
  
  html += `<ul>${arr.map(x => `<li>${x}</li>`).join("")}</ul>`;
  
  return html;
}

function showDetails(id) {
  if (!elDetails || !elTitle || !elUseCase || !elCommands || !panels || !panels.mft || !panels.usn || !panels.log) {
    console.error("Elements not initialized!");
    return;
  }
  
  const ops = getCurrentOps();
  const op = ops.find(o => o.id === id);
  if (!op) return;

  activeId = id;
  if (elSearch) {
    renderList(elSearch.value);
  } else {
    renderList("");
  }

  if (elEmpty) elEmpty.style.display = "none";
  elDetails.style.display = "block";
  elDetails.classList.add("active");

  // Scroll to top of page
  window.scrollTo({ top: 0, behavior: 'smooth' });

  elTitle.textContent = op.name;
  elUseCase.textContent = op.useCase;

  // Display commands once at the top if they exist
  if (op.commands) {
    const codeElement = elCommands.querySelector('code');
    if (codeElement) {
      // Make only the [TIME] output line bold (the line that starts with [TIME] and contains date/time)
      const formattedCommands = op.commands.replace(/^(\[TIME\] [^\n]+)$/gm, '<strong>$1</strong>');
      codeElement.innerHTML = formattedCommands;
    }
    elCommands.style.display = "block";
  } else {
    elCommands.style.display = "none";
  }

  panels.mft.innerHTML = listToHtml("$MFT", op.mft || []);
  panels.usn.innerHTML = listToHtml("$J (USN)", op.usn || [], op.usnImage, "USN Journal Screenshot");
  panels.log.innerHTML = listToHtml("$LogFile", op.log || [], op.logImage, "$LogFile Screenshot");

  // All tabs and panels start as active (multi-select)
  updatePanelVisibility();
}

function updatePanelVisibility() {
  document.querySelectorAll(".tab").forEach(btn => {
    const tab = btn.dataset.tab;
    const panel = panels[tab];
    if (panel) {
      if (btn.classList.contains("active")) {
        panel.classList.add("active");
        panel.style.display = "block";
      } else {
        panel.classList.remove("active");
        panel.style.display = "none";
      }
    }
  });
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      // Toggle active state
      btn.classList.toggle("active");
      updatePanelVisibility();
    });
  });
}

function switchType(type) {
  currentType = type;
  activeId = null;
  elDetails.style.display = "none";
  elDetails.classList.remove("active");
  elEmpty.style.display = "block";
  renderList(elSearch.value);
  
  // Update toggle buttons
  document.querySelectorAll(".type-toggle").forEach(btn => {
    btn.classList.remove("active");
  });
  document.querySelector(`.type-toggle[data-type="${type}"]`).classList.add("active");
}

// Wait for DOM to be ready
function init() {
  // Initialize element references
  elOpList = document.getElementById("opList");
  elSearch = document.getElementById("searchBox");
  elTypeToggle = document.getElementById("typeToggle");
  elEmpty = document.getElementById("emptyState");
  elDetails = document.getElementById("details");
  elTitle = document.getElementById("opTitle");
  elUseCase = document.getElementById("opUseCase");
  elCommands = document.getElementById("opCommands");
  
  panels = {
    mft: document.getElementById("panel-mft"),
    usn: document.getElementById("panel-usn"),
    log: document.getElementById("panel-log")
  };
  
  // Check if all elements exist
  if (!elOpList || !elDetails || !panels || !panels.mft || !panels.usn || !panels.log) {
    console.error("Missing critical elements:", { elOpList, elDetails, panels });
    return;
  }
  
  setupTabs();
  renderList();
  
  if (elSearch) {
    elSearch.addEventListener("input", () => renderList(elSearch.value));
  }
  
  // Setup type toggle buttons
  document.querySelectorAll(".type-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      switchType(btn.dataset.type);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Lightbox functionality
function setupLightbox() {
  const modal = document.getElementById("lightboxModal");
  const lightboxImage = document.getElementById("lightboxImage");
  const closeBtn = document.getElementById("lightboxClose");
  
  // Open lightbox when screenshot is clicked
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("screenshot")) {
      lightboxImage.src = e.target.src;
      lightboxImage.alt = e.target.alt;
      modal.classList.add("active");
      document.body.style.overflow = "hidden"; // Prevent background scrolling
    }
  });
  
  // Close lightbox
  function closeLightbox() {
    modal.classList.remove("active");
    document.body.style.overflow = ""; // Restore scrolling
  }
  
  // Close on button click
  if (closeBtn) {
    closeBtn.addEventListener("click", closeLightbox);
  }
  
  // Close on background click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeLightbox();
    }
  });
  
  // Close on ESC key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) {
      closeLightbox();
    }
  });
}

// Initialize lightbox when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupLightbox);
} else {
  setupLightbox();
}
