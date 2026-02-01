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
      "<strong>USN – DataExtend:</strong> Additional data was written to an existing file (file size increased).",
      "<strong>USN – DataExtend | Close:</strong> Final data write completed and the file handle was closed."
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
    mft: [
      "File size decreases; SI Modified time updates.",
      "Allocation size may not immediately drop to 0 depending on behavior."
    ],
    usn: [
      "Common reason: DATA_TRUNCATION; often followed by BASIC_INFO_CHANGE.",
      "If file is immediately re-written, you'll see DATA_EXTEND after truncation."
    ],
    log: [
      "Transactional steps around size change and potential deallocation behavior."
    ],
  },
  {
    id: "rename",
    name: "Rename file",
    useCase: "lsass.dmp → system.dat to hide; extension swaps",
    bestArtifacts: "$J + $MFT",
    conclusion: "Often recover old+new names (via $J), confirm final state (via $MFT)",
    mft: [
      "$FILE_NAME attribute updated (directory entry/name).",
      "SI timestamps may update (often Changed time)."
    ],
    usn: [
      "Classic pair: RENAME_OLD_NAME and RENAME_NEW_NAME.",
      "Often also BASIC_INFO_CHANGE."
    ],
    log: [
      "Transactional rename steps (metadata updates) may be visible."
    ],
  },
  {
    id: "move-same-volume",
    name: "Move file",
    useCase: "Moving payload from obvious folder to obscure location",
    bestArtifacts: "$J + $MFT",
    conclusion: "Path relationship changed; great for timeline chaining with rename/create",
    mft: [
      "Filename/path relationship changes (FN attribute reflects directory entry).",
      "MFT record usually remains the same."
    ],
    usn: [
      "Often manifests similarly to rename (old name/new name) with directory context change."
    ],
    log: [
      "Transactional metadata update steps may appear."
    ],
  },
  {
    id: "copy",
    name: "Copy file",
    useCase: "Toolkit copied into another directory",
    bestArtifacts: "$J + $MFT",
    conclusion: "Copy usually appears as create+write at destination; prove by correlation (source + destination timing)",
    mft: [
      "New MFT record at destination; original file's MFT record unchanged.",
      "Both source and destination timestamps visible if correlated."
    ],
    usn: [
      "Create event at destination; source file may show READ operations.",
      "Multiple USN records if large file (chunked copy)."
    ],
    log: [
      "Transaction records for destination file creation and data writes."
    ],
  },
  {
    id: "delete",
    name: "Delete file",
    useCase: "Post-execution cleanup",
    bestArtifacts: "$J + $MFT",
    conclusion: "Delete event time (if still in $J) + $MFT record marked unused",
    mft: [
      "MFT record may be marked unused; filename attributes may persist until reused.",
      "Recovery feasibility depends on reuse/overwrite."
    ],
    usn: [
      "Common reason: FILE_DELETE (and sometimes CLOSE)."
    ],
    log: [
      "Transactional steps around unlinking/metadata update may appear."
    ],
  },
  {
    id: "secure-delete",
    name: "Secure-delete file",
    useCase: "Anti-forensics (multiple overwrites)",
    bestArtifacts: "$LogFile (+ $J when present)",
    conclusion: "Possible overwrite-heavy patterns; confirmation often needs free-space analysis/other telemetry",
    mft: [
      "May show multiple Modified time changes if not timestomped.",
      "File size may remain but content overwritten multiple times."
    ],
    usn: [
      "Multiple DATA_OVERWRITE events in short time period.",
      "May also show delete after overwrite sequence."
    ],
    log: [
      "Multiple overwrite transactions visible if $LogFile retention allows.",
      "Strongest indicator of intentional content destruction."
    ],
  },
  {
    id: "timestomp",
    name: "Timestomp file",
    useCase: "Make file look old/new to mislead timeline",
    bestArtifacts: "$J / $LogFile vs $MFT",
    conclusion: "$MFT timestamps alone can lie; $J/$LogFile can show \"real activity time\"",
    mft: [
      "SI timestamps may show manipulated values (old or future dates).",
      "FN timestamps may still reflect real creation time if not explicitly changed."
    ],
    usn: [
      "$J timestamps reflect real activity time (not easily manipulated without admin privileges).",
      "Correlate $J timing with $MFT to detect discrepancies."
    ],
    log: [
      "$LogFile transaction timestamps show real system time of operations.",
      "Compare with $MFT to identify timestamp manipulation."
    ],
  },
  {
    id: "metadata-only",
    name: "Metadata-only change file",
    useCase: "Hide file (hidden/system), restrict access",
    bestArtifacts: "$MFT + $J",
    conclusion: "Attribute/ACL changes can appear without content writes—useful for stealth/persistence narratives",
    mft: [
      "SI attributes field changes (hidden, system, archive flags).",
      "Security descriptor may change if permissions modified."
    ],
    usn: [
      "BASIC_INFO_CHANGE reason typically present.",
      "May also show SECURITY_CHANGE if ACL modified."
    ],
    log: [
      "Transactional metadata updates visible if attributes/permissions changed."
    ],
  },
  {
    id: "ads-write",
    name: "ADS write file",
    useCase: "Hide payload in legit.txt:evil.bin",
    bestArtifacts: "$MFT + $J (sometimes $LogFile)",
    conclusion: "Evidence of stream presence/changes; good for \"hidden content\" staging",
    mft: [
      "$DATA attribute entries for named streams visible in MFT record.",
      "Main file data and ADS data shown as separate $DATA attributes."
    ],
    usn: [
      "Stream creation/write may generate USN records with stream name.",
      "FILE_CREATE or DATA_EXTEND with stream context."
    ],
    log: [
      "Transactional records for stream attribute creation and data writes."
    ],
  }
];

const FOLDER_OPS = [
  {
    id: "create-folder",
    name: "Create folder",
    useCase: "Create staging dir: C:\\ProgramData\\Intel\\Cache\\",
    bestArtifacts: "$J + $MFT",
    conclusion: "Folder creation happened around X; helps explain later file drops",
    mft: [
      "New MFT record allocated for directory; $INDEX_ROOT and/or $INDEX_ALLOCATION present.",
      "SI timestamps set (Created/Modified/Changed).",
      "Directory entry appears in parent directory's index."
    ],
    usn: [
      "USN record includes: USN_REASON_FILE_CREATE for the directory.",
      "Parent directory may show INDEX_CHANGE event."
    ],
    log: [
      "Transaction activity for directory record allocation and index updates."
    ],
  },
  {
    id: "rename-folder",
    name: "Rename folder",
    useCase: "Rename staging dir after use to look benign",
    bestArtifacts: "$J + $MFT",
    conclusion: "Old/new folder names often visible via $J; $MFT confirms final state",
    mft: [
      "$FILE_NAME attribute updated in directory's MFT record.",
      "SI Changed time typically updates.",
      "Parent directory's index updated with new name."
    ],
    usn: [
      "RENAME_OLD_NAME and RENAME_NEW_NAME reasons for the directory.",
      "Parent directory may show INDEX_CHANGE."
    ],
    log: [
      "Transactional rename steps for directory metadata updates."
    ],
  },
  {
    id: "move-folder",
    name: "Move folder (same volume)",
    useCase: "Move entire toolkit to a different path",
    bestArtifacts: "$J + $MFT",
    conclusion: "Directory relocation evidence; supports \"toolkit moved then executed\" story",
    mft: [
      "Directory's FN attribute shows new parent path.",
      "MFT record usually remains the same (same volume move).",
      "Both old and new parent directories' indexes updated."
    ],
    usn: [
      "RENAME events showing old/new paths for directory.",
      "Multiple INDEX_CHANGE events in old/new parent directories."
    ],
    log: [
      "Transactional steps for directory relocation and index updates."
    ],
  },
  {
    id: "delete-folder",
    name: "Delete folder",
    useCase: "Cleanup after exfil/tool execution",
    bestArtifacts: "$J + $MFT",
    conclusion: "Folder deletion timing (if in $J) + MFT record state change",
    mft: [
      "Directory MFT record marked unused (if not recycled yet).",
      "Parent directory's index updated (directory entry removed).",
      "Child files/directories may remain until explicitly deleted."
    ],
    usn: [
      "FILE_DELETE reason for the directory.",
      "Parent directory shows INDEX_CHANGE event."
    ],
    log: [
      "Transactional steps around directory unlinking and index updates."
    ],
  },
  {
    id: "permission-folder",
    name: "Permission/ACL change on folder",
    useCase: "Block access, persistence via restricted dirs",
    bestArtifacts: "$MFT + $J",
    conclusion: "Shows security/attribute changes affecting many child files indirectly",
    mft: [
      "Directory's security descriptor modified in $STANDARD_INFORMATION.",
      "Access permissions, ownership, or audit settings changed."
    ],
    usn: [
      "SECURITY_CHANGE or BASIC_INFO_CHANGE reason for directory.",
      "May affect child files' effective permissions."
    ],
    log: [
      "Transactional security descriptor updates for directory."
    ],
  },
  {
    id: "hide-folder",
    name: "Hide folder (attributes)",
    useCase: "Mark as hidden/system to reduce visibility",
    bestArtifacts: "$MFT + $J",
    conclusion: "Attribute change evidence even if no file content changes",
    mft: [
      "SI attributes field updated (hidden, system flags set).",
      "Directory still accessible but less visible in normal listings."
    ],
    usn: [
      "BASIC_INFO_CHANGE reason for directory.",
      "Attribute modification timestamp updated."
    ],
    log: [
      "Transactional metadata update for attribute changes."
    ],
  }
];


let currentType = "FILE"; // "FILE" or "FOLDER"
let activeId = null;

const elOpList = document.getElementById("opList");
const elSearch = document.getElementById("searchBox");
const elTypeToggle = document.getElementById("typeToggle");

const elEmpty = document.getElementById("emptyState");
const elDetails = document.getElementById("details");
const elTitle = document.getElementById("opTitle");
const elUseCase = document.getElementById("opUseCase");
const elCommands = document.getElementById("opCommands");

const panels = {
  mft: document.getElementById("panel-mft"),
  usn: document.getElementById("panel-usn"),
  log: document.getElementById("panel-log")
};

function getCurrentOps() {
  if (currentType === "FILE") return FILE_OPS;
  if (currentType === "FOLDER") return FOLDER_OPS;
  return FILE_OPS;
}

function renderList(filter = "") {
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
  const ops = getCurrentOps();
  const op = ops.find(o => o.id === id);
  if (!op) return;

  activeId = id;
  renderList(elSearch.value);

  elEmpty.style.display = "none";
  elDetails.style.display = "block";
  elDetails.classList.add("active");

  // Scroll to top of page
  window.scrollTo({ top: 0, behavior: 'smooth' });

  elTitle.textContent = op.name;
  elUseCase.textContent = op.useCase;

  // Display commands once at the top if they exist
  if (op.commands && elCommands) {
    const codeElement = elCommands.querySelector('code');
    if (codeElement) {
      // Make only the [TIME] output line bold
      const formattedCommands = op.commands.replace(/^(\[TIME\] [^\n]+)$/gm, '<strong>$1</strong>');
      codeElement.innerHTML = formattedCommands;
    }
    elCommands.style.display = 'block';
  } else if (elCommands) {
    elCommands.style.display = 'none';
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setupTabs();
    renderList();
  });
} else {
  setupTabs();
  renderList();
}

if (elSearch) {
  elSearch.addEventListener("input", () => renderList(elSearch.value));
}

// Setup type toggle buttons
document.querySelectorAll(".type-toggle").forEach(btn => {
  btn.addEventListener("click", () => {
    switchType(btn.dataset.type);
  });
});
