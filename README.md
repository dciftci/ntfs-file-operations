# NTFS Artifacts Guide — $MFT / $J / $LogFile

Interactive reference tool for understanding how file and folder operations appear in NTFS artifacts ($MFT, $J/USN Journal, $LogFile).

## 🎯 Purpose

This tool helps digital forensics analysts and security researchers understand:
- How different file operations (create, write, rename, delete, etc.) manifest in **$MFT**
- What USN reason flags appear in **$J (USN Journal)**
- What transactional patterns appear in **$LogFile**
- Which Windows API calls / file methods are typically used
- Common pitfalls and false positives

## 🚀 GitHub Pages Deployment

### Quick Setup

1. **Create GitHub Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: NTFS Artifacts Guide"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**
   - Go to repository **Settings** → **Pages**
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/ (root)**
   - Click **Save**

3. **Your site will be live at:**
   ```
   https://YOUR_USERNAME.github.io/YOUR_REPO/
   ```

## 📁 File Structure

```
.
├── index.html      # Main HTML structure
├── style.css       # Dark theme styling
├── app.js          # Operation data + UI logic
└── README.md       # This file
```

## 🔍 Features

- **Interactive Operation Browser**: Click operations to view detailed artifact signals
- **Multi-Artifact View**: Tabs for $MFT, $J (USN), $LogFile, API patterns, and pitfalls
- **Search**: Filter operations by name, description, or API method
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Theme**: Easy on the eyes for long analysis sessions

## 📋 Included Operations

- Create File
- Write / Modify (Append or Change)
- Overwrite (In-place Replace Content)
- Truncate (Shrink File / Clear Log)
- Rename File
- Move File (Same Volume)
- Delete File

## 🎨 Customization

To add more operations or modify existing ones, edit the `OPS` array in `app.js`:

```javascript
{
  id: "operation-id",
  name: "Operation Name",
  tag: "FILE",
  desc: "Description...",
  chips: ["Tag 1", "Tag 2"],
  mft: ["MFT artifact details..."],
  usn: ["USN journal details..."],
  log: ["LogFile details..."],
  api: ["API method 1", "API method 2"],
  pitfalls: ["Common pitfall 1", "Common pitfall 2"]
}
```

## 📝 Notes

- This is a **static site** (no backend required)
- All data is embedded in `app.js`
- Easy to extend with additional operations
- Perfect for GitHub Pages hosting

## 🔗 Useful Resources

- [NTFS Documentation (Microsoft)](https://docs.microsoft.com/en-us/windows/win32/fileio/file-attribute-constants)
- [USN Journal Structure](https://docs.microsoft.com/en-us/windows/win32/api/winioctl/ns-winioctl-usn_record_v2)
- [MFT Structure Analysis](https://www.forensicswiki.org/wiki/MFT)

## 📄 License

Free to use and modify for educational and professional purposes.
