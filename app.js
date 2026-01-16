const OPS = [
  {
    id: "create-file",
    name: "Create File",
    tag: "FILE",
    desc: "New file appears on disk (dropper, staging output, temporary artifact).",
    chips: ["High value for timelines", "Correlate $J + $MFT"],
    mft: [
      "New MFT record allocated; $STANDARD_INFORMATION (SI) + $FILE_NAME (FN) attributes present.",
      "SI timestamps set (Created/Modified/Changed). FN timestamps may reflect directory entry creation.",
      "$DATA attribute appears (resident or non-resident depending on size)."
    ],
    usn: [
      "USN record commonly includes: USN_REASON_FILE_CREATE (+ often BASIC_INFO_CHANGE).",
      "Follow-up USN entries usually appear quickly for initial writes (DATA_EXTEND / DATA_OVERWRITE)."
    ],
    log: [
      "Transaction activity for record allocation + attribute initialization.",
      "Often reflects the low-level steps of creating metadata and preparing file data."
    ],
    api: [
      "CreateFile(...) with CREATE_NEW / CREATE_ALWAYS",
      "WriteFile(...) (if initial content written)",
      "CloseHandle(...)"
    ],
    pitfalls: [
      "Some apps use 'safe save': create temp file → write → rename swap (looks like create+rename, not overwrite).",
      "USN Journal can roll over; absence in $J ≠ no creation."
    ]
  },
  {
    id: "write-modify",
    name: "Write / Modify (Append or Change)",
    tag: "FILE",
    desc: "Existing file content is modified or appended (logs, configs, staging archives).",
    chips: ["Great for tool execution traces", "Watch safe-save patterns"],
    mft: [
      "SI Modified time typically updates; size/allocation may change.",
      "$DATA attribute VCN/LCN mapping changes if file grows (non-resident)."
    ],
    usn: [
      "Common reasons: DATA_EXTEND (growth), DATA_OVERWRITE (in-place change), BASIC_INFO_CHANGE.",
      "Write bursts may produce multiple USN records."
    ],
    log: [
      "Shows transactional write sequence (redo/undo style records) when metadata/data updates occur.",
      "Useful to understand 'how' the write happened (sequence), not just that it happened."
    ],
    api: [
      "CreateFile(..., OPEN_EXISTING)",
      "SetFilePointer/SetFilePointerEx (optional)",
      "WriteFile(...) / FlushFileBuffers(...)",
      "CloseHandle(...)"
    ],
    pitfalls: [
      "Log rotation can look like truncate + new writes (normal behavior).",
      "$MFT timestamps alone can be misleading if attacker timestomps."
    ]
  },
  {
    id: "overwrite",
    name: "Overwrite (In-place Replace Content)",
    tag: "FILE",
    desc: "Content replaced without deleting the file (anti-forensics, log tampering).",
    chips: ["Best: $J + $LogFile", "Validate vs safe-save"],
    mft: [
      "SI Modified time changes; file size may stay the same (classic overwrite) or change (overwrite+extend).",
      "No new record necessarily—same MFT entry persists."
    ],
    usn: [
      "Often includes DATA_OVERWRITE; sometimes DATA_EXTEND depending on behavior.",
      "If app uses temp+rename, you may see rename events instead of overwrite."
    ],
    log: [
      "Strongest place (among these) to reason about in-place update steps when available.",
      "Can help differentiate overwrite vs create+rename swap patterns."
    ],
    api: [
      "CreateFile(..., OPEN_EXISTING)",
      "WriteFile(...) at existing offsets",
      "FlushFileBuffers(...) (optional)"
    ],
    pitfalls: [
      "Many editors do NOT overwrite in place; they do safe-save (temp file + rename).",
      "Absence in $LogFile is common depending on retention/volume activity."
    ]
  },
  {
    id: "truncate",
    name: "Truncate (Shrink File / Clear Log)",
    tag: "FILE",
    desc: "File size reduced (often to 0) while keeping the filename (log wiping).",
    chips: ["Very common for log tampering", "Check for follow-up writes"],
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
    api: [
      "SetEndOfFile(...) or SetFileInformationByHandle(FileEndOfFileInfo)",
      "Sometimes followed by WriteFile(...)"
    ],
    pitfalls: [
      "Normal apps/loggers rotate or truncate logs automatically (avoid over-attribution)."
    ]
  },
  {
    id: "rename",
    name: "Rename File",
    tag: "FILE",
    desc: "Filename changed to hide intent (e.g., dump renamed to benign-looking name).",
    chips: ["$J is king for old/new", "Correlate path context"],
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
    api: [
      "MoveFileEx(...) / MoveFile(...)",
      "SetFileInformationByHandle(FileRenameInfo)"
    ],
    pitfalls: [
      "Rename is also common in normal software updates and safe-save workflows."
    ]
  },
  {
    id: "move-same-volume",
    name: "Move File (Same Volume)",
    tag: "FILE",
    desc: "File moved to different directory on same NTFS volume (staging / hiding).",
    chips: ["Looks like rename at NTFS level", "Focus on directory context"],
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
    api: [
      "MoveFileEx(...) / MoveFile(...)"
    ],
    pitfalls: [
      "Moves across volumes become copy+delete (different pattern)."
    ]
  },
  {
    id: "delete",
    name: "Delete File",
    tag: "FILE",
    desc: "File removed (post-execution cleanup).",
    chips: ["$J provides timing", "$MFT shows record state"],
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
    api: [
      "DeleteFile(...)",
      "Or SetFileInformationByHandle(FileDispositionInfo / FileDispositionInfoEx)"
    ],
    pitfalls: [
      "Recycle Bin behavior can create extra moves/renames instead of direct delete."
    ]
  }
];

const elOpList = document.getElementById("opList");
const elSearch = document.getElementById("searchBox");

const elEmpty = document.getElementById("emptyState");
const elDetails = document.getElementById("details");
const elTitle = document.getElementById("opTitle");
const elDesc = document.getElementById("opDesc");
const elChips = document.getElementById("opChips");

const panels = {
  mft: document.getElementById("panel-mft"),
  usn: document.getElementById("panel-usn"),
  log: document.getElementById("panel-log"),
  api: document.getElementById("panel-api"),
  pitfalls: document.getElementById("panel-pitfalls")
};

let activeId = null;

function renderList(filter = "") {
  elOpList.innerHTML = "";
  const q = filter.trim().toLowerCase();
  const items = OPS.filter(o =>
    !q ||
    o.name.toLowerCase().includes(q) ||
    o.desc.toLowerCase().includes(q) ||
    o.tag.toLowerCase().includes(q) ||
    (o.api || []).some(x => x.toLowerCase().includes(q))
  );

  items.forEach(op => {
    const li = document.createElement("li");
    li.className = "op-item" + (op.id === activeId ? " active" : "");
    li.innerHTML = `
      <div class="op-header">
        <div class="op-name">${op.name}</div>
        <div class="op-tag">${op.tag}</div>
      </div>
      <div class="op-desc">${op.desc}</div>
    `;
    li.onclick = () => showDetails(op.id);
    elOpList.appendChild(li);
  });
}

function listToHtml(title, arr) {
  return `
    <h3>${title}</h3>
    <ul>
      ${arr.map(x => `<li>${x}</li>`).join("")}
    </ul>
  `;
}

function showDetails(id) {
  const op = OPS.find(o => o.id === id);
  if (!op) return;

  activeId = id;
  renderList(elSearch.value);

  elEmpty.style.display = "none";
  elDetails.style.display = "block";
  elDetails.classList.add("active");

  elTitle.textContent = op.name;
  elDesc.textContent = op.desc;

  elChips.innerHTML = (op.chips || []).map(c => `<span class="chip">${c}</span>`).join("");

  panels.mft.innerHTML = listToHtml("$MFT — how it typically appears", op.mft || []);
  panels.usn.innerHTML = listToHtml("$J (USN) — common reason flags / signals", op.usn || []);
  panels.log.innerHTML = listToHtml("$LogFile — what you may observe", op.log || []);
  panels.api.innerHTML = listToHtml("Likely Windows file method / API pattern", op.api || []);
  panels.pitfalls.innerHTML = listToHtml("Pitfalls / false positives", op.pitfalls || []);

  // reset tabs
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  const firstTab = document.querySelector('.tab[data-tab="mft"]');
  if (firstTab) firstTab.classList.add("active");

  Object.keys(panels).forEach(k => {
    if (panels[k]) {
      panels[k].classList.remove("active");
      panels[k].style.display = "none";
    }
  });
  if (panels.mft) {
    panels.mft.classList.add("active");
    panels.mft.style.display = "block";
  }
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      Object.keys(panels).forEach(k => {
        if (panels[k]) {
          panels[k].classList.remove("active");
          panels[k].style.display = "none";
        }
      });
      if (panels[tab]) {
        panels[tab].classList.add("active");
        panels[tab].style.display = "block";
      }
    });
  });
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
