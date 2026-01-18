const FILE_OPS = [
  {
    id: "create-file",
    name: "Create file",
    useCase: "Payload drop in Temp, tool output (dump/log), staging files",
    bestArtifacts: "$J + $MFT",
    conclusion: "File creation activity happened around X; $MFT confirms file record + metadata",
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
    lnk: [
      "LNK files may be created pointing to this new file (shortcut creation for persistence or user convenience).",
      "LNK file creation timestamp may correlate with target file creation if shortcut created immediately.",
      "Check Desktop, Start Menu, Quick Launch for related .lnk files referencing this target."
    ]
  },
  {
    id: "write-modify",
    name: "Write / Modify file",
    useCase: "Logging, config edits, building an archive gradually",
    bestArtifacts: "$J + $LogFile, validate with $MFT",
    conclusion: "Content was written/extended; $LogFile can show write sequencing, $J shows high-level change",
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
    lnk: [
      "LNK files pointing to this target remain valid (target path unchanged).",
      "LNK file Accessed time may update if shortcut used to launch/access the modified file.",
      "No LNK structure changes unless target executable path changed."
    ]
  },
  {
    id: "overwrite",
    name: "Overwrite file",
    useCase: "\"Clean-up\" by overwriting logs/artifacts without deleting",
    bestArtifacts: "$J + $LogFile",
    conclusion: "Strong evidence of content replacement (vs just metadata change)",
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
    lnk: [
      "LNK files remain valid if target file path unchanged (overwrite preserves file name/path).",
      "LNK file Accessed time may reflect when shortcut was used to access the overwritten content.",
      "If target is executable, LNK execution may trigger after overwrite (timeline correlation)."
    ]
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
    lnk: [
      "LNK files pointing to truncated file remain valid (file path/name unchanged).",
      "If target executable truncated to 0, LNK execution may fail (check for error indicators).",
      "LNK file Accessed time may correlate with truncation event if shortcut attempted before/after."
    ]
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
    lnk: [
      "LNK files with old file path become broken/unresolvable (target path mismatch).",
      "Broken LNK files may show error indicators when accessed (useful for timeline correlation).",
      "New LNK files may be created with new path; compare LNK creation time with rename time.",
      "Check for LNK file modification attempts to update target path after rename."
    ]
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
    lnk: [
      "LNK files with old file path become broken/unresolvable after move (target path mismatch).",
      "Broken LNK files show error when accessed; useful for timeline correlation with move event.",
      "Check for LNK file creation at new location or LNK target path updates.",
      "LNK files in Start Menu, Desktop may become invalid if target moved."
    ]
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
    lnk: [
      "New LNK files may be created at destination pointing to copied file.",
      "Original LNK files at source location remain valid (source file unchanged).",
      "Check for LNK file creation timestamps correlating with copy destination timestamp."
    ]
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
    lnk: [
      "LNK files pointing to deleted file become broken/unresolvable.",
      "Broken LNK files remain on disk (Desktop, Start Menu) and show errors when accessed.",
      "LNK file creation time helps establish timeline (target existed before deletion).",
      "Deleted file recovery may be possible via LNK file content (contains target path)."
    ]
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
    lnk: [
      "LNK files remain valid (file path/name unchanged, only content wiped).",
      "LNK execution attempts may fail if target executable was securely deleted.",
      "Check LNK file Accessed timestamps for execution attempts after secure delete.",
      "LNK file may still contain target path even if target content is destroyed."
    ]
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
    lnk: [
      "LNK file timestamps may also be manipulated (timestomped) to match target file.",
      "Compare LNK file MFT timestamps with LNK internal timestamp fields for discrepancies.",
      "LNK execution timestamps (Prefetch, ShimCache) show real execution time (not easily manipulated).",
      "Correlate LNK file creation time with target file timestamps to detect manipulation."
    ]
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
    lnk: [
      "LNK files remain valid (target path unchanged, only attributes/permissions modified).",
      "Hidden file attribute change doesn't affect LNK file functionality (shortcut still works).",
      "If permissions restrict access, LNK execution may fail with access denied errors.",
      "LNK file Accessed time may reflect execution attempts after permission changes."
    ]
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
    lnk: [
      "LNK files remain valid (main file path unchanged, ADS is additional stream).",
      "LNK execution may load ADS stream if target executable contains ADS payload.",
      "LNK file may point to ADS stream directly (rare: target.exe:stream.bin format).",
      "ADS detection via LNK file content analysis (if target path includes stream reference)."
    ]
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
    lnk: [
      "LNK files may be created in new folder (shortcuts to files placed in staging directory).",
      "LNK files created in folder show creation timestamp correlating with folder creation.",
      "Check folder for .lnk files pointing to executables dropped in staging location.",
      "Folder path becomes part of LNK target path (e.g., C:\\staging\\tool.exe)."
    ]
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
    lnk: [
      "LNK files with target paths containing old folder name become broken/unresolvable.",
      "LNK files need target path update or become invalid after folder rename.",
      "Check for LNK file modification timestamps correlating with folder rename time.",
      "Broken LNK files in Start Menu/Desktop if they reference renamed folder paths."
    ]
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
    lnk: [
      "LNK files with target paths containing old folder location become broken/unresolvable.",
      "LNK files need target path update after folder move or show errors when accessed.",
      "Check for LNK file creation at new location or modification timestamps after move.",
      "Broken LNK files indicate folder move timeline (LNK created before move, accessed after)."
    ]
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
    lnk: [
      "LNK files with target paths in deleted folder become broken/unresolvable.",
      "Broken LNK files remain on disk (Desktop, Start Menu) showing folder path in target.",
      "LNK file creation timestamps show when target folder existed (before deletion).",
      "LNK file content may contain full target path including deleted folder (useful for recovery/reconstruction)."
    ]
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
    lnk: [
      "LNK files remain valid (target paths unchanged, only folder permissions modified).",
      "If folder permissions restrict access, LNK execution may fail with access denied errors.",
      "LNK files in folder may become inaccessible if folder permissions prevent reading.",
      "LNK file Accessed timestamps may reflect execution attempts affected by permission changes."
    ]
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
    lnk: [
      "LNK files remain valid (target paths unchanged, only folder attributes modified).",
      "Hidden folder attribute doesn't affect LNK file functionality (shortcuts still work).",
      "LNK files in hidden folder may be less visible but remain functional.",
      "Folder path in LNK target remains valid even if folder is hidden."
    ]
  }
];

const LNK_OPS = [
  {
    id: "create-lnk",
    name: "Create LNK (shortcut)",
    useCase: "Desktop/Start Menu shortcuts for persistence, launching payloads, or hiding execution",
    bestArtifacts: "$J + $MFT",
    conclusion: "LNK file creation timestamp and location; target path visible in LNK file content",
    mft: [
      "New MFT record for .lnk file; standard file record structure.",
      "SI timestamps set (Created/Modified/Changed).",
      "$DATA attribute contains LNK binary format data (target path, working dir, icon, flags)."
    ],
    usn: [
      "USN_REASON_FILE_CREATE for the .lnk file.",
      "May also show BASIC_INFO_CHANGE if metadata written after creation."
    ],
    log: [
      "Transaction activity for LNK file record allocation and data writes."
    ]
  },
  {
    id: "modify-lnk-target",
    name: "Modify LNK target path",
    useCase: "Change shortcut target to redirect to different executable (pivot attack, redirection)",
    bestArtifacts: "$MFT + $J (LNK file content)",
    conclusion: "Target path change in LNK file content; Modified timestamp updated; useful for tracking redirection",
    mft: [
      "SI Modified time updates when LNK target changed.",
      "$DATA attribute overwritten with new LNK structure containing updated target path.",
      "File size may change if new target path length differs."
    ],
    usn: [
      "DATA_OVERWRITE or DATA_EXTEND reason (depending on size change).",
      "BASIC_INFO_CHANGE if metadata (working dir, icon) also modified."
    ],
    log: [
      "Transactional steps showing LNK file content modification (target path change)."
    ]
  },
  {
    id: "modify-lnk-metadata",
    name: "Modify LNK metadata (icon, working dir, flags)",
    useCase: "Change shortcut appearance or behavior (icon spoofing, working directory for relative paths)",
    bestArtifacts: "$MFT + $J",
    conclusion: "Metadata changes visible in LNK file; Modified timestamp reflects update",
    mft: [
      "SI Modified time updates.",
      "$DATA attribute shows updated LNK flags, icon location, or working directory fields.",
      "File size may change slightly depending on metadata size."
    ],
    usn: [
      "DATA_OVERWRITE or BASIC_INFO_CHANGE reason.",
      "May show multiple USN records if multiple fields changed."
    ],
    log: [
      "Transactional metadata updates within LNK file structure."
    ]
  },
  {
    id: "delete-lnk",
    name: "Delete LNK",
    useCase: "Remove persistence shortcuts after execution or cleanup",
    bestArtifacts: "$J + $MFT",
    conclusion: "LNK file deletion timestamp; target path may still be recoverable from deleted LNK",
    mft: [
      "LNK file MFT record marked unused.",
      "LNK file name attributes may persist until MFT record reused.",
      "LNK file content (including target path) may remain on disk until overwritten."
    ],
    usn: [
      "FILE_DELETE reason for the .lnk file."
    ],
    log: [
      "Transactional steps for LNK file unlinking and MFT record state change."
    ]
  },
  {
    id: "lnk-timestamps",
    name: "LNK file timestamps (Created/Modified/Accessed)",
    useCase: "Timeline analysis for shortcut creation vs target execution; detect timestamp manipulation",
    bestArtifacts: "$MFT SI timestamps + LNK internal timestamps",
    conclusion: "Compare MFT timestamps with LNK internal timestamps; discrepancies may indicate manipulation",
    mft: [
      "SI Created time: LNK file creation on disk.",
      "SI Modified time: Last time LNK file content changed (target/metadata update).",
      "SI Accessed time: May reflect when shortcut was used (if tracking enabled)."
    ],
    usn: [
      "$J timestamps show actual file system activity times.",
      "Correlate with LNK internal timestamps (stored in LNK file structure)."
    ],
    log: [
      "$LogFile shows real system time of LNK file operations.",
      "Compare with LNK file's internal timestamp fields for discrepancies."
    ]
  },
  {
    id: "lnk-target-execution",
    name: "LNK target execution (via shortcut)",
    useCase: "Shortcut used to launch executable (persistence mechanism, user-initiated execution)",
    bestArtifacts: "Prefetch, ShimCache, Amcache + $MFT/$J for LNK file access",
    conclusion: "LNK file Accessed time may update; target executable execution artifacts appear; useful for persistence timeline",
    mft: [
      "LNK file SI Accessed time may update (depending on system configuration).",
      "Target executable shows execution artifacts (Prefetch, $MFT timestamps, etc.).",
      "Correlate LNK location (Desktop/Start Menu) with execution time."
    ],
    usn: [
      "May show FILE_ACCESS if LNK file read tracked.",
      "Target executable shows FILE_CREATE/EXECUTION if new process launched."
    ],
    log: [
      "LNK file access transactions may appear.",
      "Target executable launch transactions visible in $LogFile if process creation tracked."
    ]
  }
];

let currentType = "FILE"; // "FILE", "FOLDER", or "LNK"
let activeId = null;

const elOpList = document.getElementById("opList");
const elSearch = document.getElementById("searchBox");
const elTypeToggle = document.getElementById("typeToggle");

const elEmpty = document.getElementById("emptyState");
const elDetails = document.getElementById("details");
const elTitle = document.getElementById("opTitle");
const elUseCase = document.getElementById("opUseCase");

const panels = {
  mft: document.getElementById("panel-mft"),
  usn: document.getElementById("panel-usn"),
  log: document.getElementById("panel-log"),
  lnk: document.getElementById("panel-lnk")
};

function getCurrentOps() {
  if (currentType === "FILE") return FILE_OPS;
  if (currentType === "FOLDER") return FOLDER_OPS;
  if (currentType === "LNK") return LNK_OPS;
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

function listToHtml(title, arr) {
  if (!arr || arr.length === 0) return "";
  return `
    <h3>${title}</h3>
    <ul>
      ${arr.map(x => `<li>${x}</li>`).join("")}
    </ul>
  `;
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

  panels.mft.innerHTML = listToHtml("$MFT — how it typically appears", op.mft || []);
  panels.usn.innerHTML = listToHtml("$J (USN) — common reason flags / signals", op.usn || []);
  panels.log.innerHTML = listToHtml("$LogFile — what you may observe", op.log || []);
  panels.lnk.innerHTML = listToHtml("LNK Files — shortcut-related artifacts", op.lnk || []);

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
