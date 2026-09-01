# Git Configuration for This Repository

## ⚠️ Important: Memory Error Fix

If you encounter this error when pushing:
```
fatal: Out of memory, malloc failed (tried to allocate 524288000 bytes)
```

Run this **once on your machine** to fix it permanently:

```powershell
git config --global http.postBuffer 157286400
git config --global core.compression 1
```

---

## Why This Matters

Git's default settings can cause memory exhaustion when pushing to GitHub, even for small repositories. This was happening with our ~2MB repo because:

- Default `core.compression` was set to 9 (maximum), which is CPU and memory intensive
- `http.postBuffer` can grow unexpectedly when not explicitly configured

### Optimal Settings Explained

| Setting | Value | Why |
|---------|-------|-----|
| `http.postBuffer` | 157286400 (150MB) | Balanced: large enough for most pushes, small enough to avoid memory issues |
| `core.compression` | 1 | Minimal compression reduces CPU/memory overhead |

---

## One-Time Setup (Do This First)

### On Windows (PowerShell)
```powershell
git config --global http.postBuffer 157286400
git config --global core.compression 1
```

### On macOS/Linux (Bash)
```bash
git config --global http.postBuffer 157286400
git config --global core.compression 1
```

### Verify It Worked
```bash
git config --global http.postBuffer   # Should show: 157286400
git config --global core.compression  # Should show: 1
```

---

## Repository-Specific Settings

This repo already has local `.git/config` set up with these values. New clones will inherit them, but you still need to set the **global** settings above for your first clone and other repositories.

---

## Troubleshooting

### Still Getting Memory Errors?

1. **Run garbage collection first**
   ```bash
   git gc --aggressive
   ```

2. **Try using SSH instead of HTTPS**
   ```bash
   git remote set-url origin git@github.com:Hery21/crunch-cart-magic.git
   ```

3. **Check current settings**
   ```bash
   git config --global --list | grep -E "(http|compression)"
   ```

### Reset to Defaults
```bash
git config --global --unset http.postBuffer
git config --global --unset core.compression
```

---

## References
- Git HTTP buffer documentation
- Git compression settings: [core.compression](https://git-scm.com/docs/git-config#core.compression)
