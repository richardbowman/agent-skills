# Proxmox homelab infrastructure reference

How to control a Proxmox VE host and use it as offload capacity for dev work — shared Postgres, heavy builds/tests/E2E, and GPU-passthrough LLM inference — so a workstation with limited cores/RAM doesn't have to run everything locally.

This is the infra-level "why it's built this way, and what went wrong getting there" reference. Day-to-day use lives in [../SKILL.md](../SKILL.md).

**Conventions used below** — substitute your own values:

| Placeholder | Meaning |
|---|---|
| `<node>` | Proxmox node name |
| `<host-ip>` | Proxmox host's LAN address |
| `<user>` | Linux user created in the VMs by cloud-init |
| `<vm-ip>/<prefix>`, `<gateway>` | a VM's static address, e.g. `192.168.x.y/24`, and the LAN gateway |
| VMIDs `101`, `200`, `201`, `300` | template, Postgres VM, build VM, LLM VM — arbitrary, pick your own |

## Host access

- **Web UI:** `https://<host-ip>:8006`
- **SSH:** key auth only. A password-manager SSH agent as the default `IdentityAgent` works well — no password or passphrase prompts. If SSH fails with `sign_and_send_pubkey: signing failed`, the agent's vault has re-locked; unlock it and retry. It is not a Proxmox-side problem.

Suggested `~/.ssh/config` aliases (this is what the skill's recipes assume):

```
Host proxmox
  HostName <host-ip>
  User root
Host dev-postgres
  HostName <postgres-vm-ip>
  User <user>
Host dev-builder
  HostName <builder-vm-ip>
  User <user>
Host llm-server
  HostName <llm-vm-ip>
  User <user>
```

Keep real addresses in `~/.ssh/config` only — never in committed files.

## ISO storage on a USB stick (optional)

A Ventoy USB stick can be mounted persistently as Proxmox storage:

- Mount it at `/mnt/pve/<storage-name>` with an fstab entry keyed by **UUID** and `nofail`, so a reboot never hangs if it's unplugged.
- ISOs must live under `<mount>/template/iso/` (Proxmox's directory-storage convention), not the partition root. exFAT doesn't support symlinks, so this means **moving** files, not linking.
- Ventoy recursively scans the whole partition, so moving ISOs into the subfolder doesn't break booting the stick directly on other hardware.

**Download an ISO straight into Proxmox (no browser, no manual USB handling):**

```sh
ssh proxmox "pvesh create /nodes/<node>/storage/<storage-name>/download-url \
  --url '<iso-url>' \
  --filename <name>.iso \
  --content iso \
  --checksum <sha256> \
  --checksum-algorithm sha256"
```

Always fetch the checksum from the vendor's published `SHA256SUMS` first — `pvesh` verifies it and fails loudly on mismatch. Get the exact current filename from the vendor's site rather than guessing a version number.

## The golden-image template (VMID 101)

An Ubuntu LTS **cloud image** (not the ISO installer), imported as a disk and turned into a Proxmox template. This is what makes new VMs unattended: no console, no installer wizard.

**Bake in:**

- `qemu-guest-agent`, installed and enabled. The stock Ubuntu cloud image does **not** ship it — it's the first thing to check if `qm agent <id> ping` hangs on a VM built from scratch.
- Cloud-init configured for your user and your SSH public key.
- Scrubbed identity so clones don't share it: `cloud-init clean --logs`, a blanked `/etc/machine-id`, and removed `/etc/ssh/ssh_host_*`.

**Clone a new VM:**

```sh
ssh proxmox 'qm clone 101 <newid> --name <name> --full'
ssh proxmox 'qm set <newid> --cores <n> --memory <MB>'
# static IP (see gotcha below) or omit for DHCP:
ssh proxmox 'qm set <newid> --ipconfig0 "ip=<vm-ip>/<prefix>,gw=<gateway>"'
ssh proxmox 'qm resize <newid> scsi0 <size>G'   # only if bigger than the template's disk
ssh proxmox 'qm start <newid>'
```

**Get its IP once booted** (works before you know the address — this is why the guest agent matters):

```sh
ssh proxmox "qm agent <newid> network-get-interfaces"
```

### Gotcha: static IP race on first boot

Cloud-init's `set-name` + static-address netplan file can lose a race with the interface already coming up via a cached/default DHCP path. Symptom: `qm agent <id> network-get-interfaces` shows a DHCP-leased address instead of the static one, even though `qm cloudinit dump <id> network` shows the correct static config. Force a reapply once:

```sh
ssh proxmox "qm guest exec <id> -- netplan apply"
```

After that it's stable. (A plain reboot also fixes it; the exec is faster.)

### Gotcha: every clone reruns `package_upgrade: true`

Proxmox's cloud-init generator hardcodes `package_upgrade: true` — no `qm set` flag disables it. It adds ~30–60s to first boot (`cloud-init status` shows `running` until it finishes; watch it via `qm guest exec <id> -- cloud-init status`, exit code `2` = still running, `0` = done). Because the template's packages are already current, it's fast. If it gets slow, re-upgrade and re-template rather than fighting the flag.

### Gotcha: pick static IPs outside the router's DHCP pool

If a static address falls inside the router's DHCP range, another device can be leased the same address. Add a reservation or exclusion on the router for each static VM address.

## dev-postgres (VMID 200)

Purpose: one shared Postgres host so worktree sessions don't each spin up their own `podman machine` VM-in-a-VM on a Mac. It runs the **exact same recipe** as the `podman-postgres` skill, just on real Linux instead of nested virtualization.

Suggested size: 2 vCPU / 4 GB RAM, static IP, `podman` installed natively (`apt install podman` — no `podman machine` needed on real Linux).

### Gotcha: containers die when the SSH session that started them ends

Rootless Podman ties a container's cgroup to the user's systemd **login session**. `--restart=unless-stopped` only replays on next *boot* — it does **not** keep a container alive when the launching session closes. Without linger, `podman run …` over `ssh dev-postgres '…'` starts the container, then the moment the SSH connection closes systemd tears down the session and the container exits (`Exited (0)` — looks clean, easy to miss).

**Fix once, before running anything else on the box:**

```sh
ssh dev-postgres 'sudo loginctl enable-linger <user>'
```

The `podman-postgres` skill's "Autostart on host boot" section already says to do this, but it's easy to skip because on a Mac none of this applies. On these VMs treat it as a required one-time setup step, and do it first on **every** new VM that will run rootless containers.

### Gotcha: `--restart=unless-stopped` doesn't survive a VM reboot — use `--restart=always`

Linger fixes containers dying when the *SSH session* ends, but a **VM reboot** (e.g. the Proxmox host rebooting) is a separate failure mode. `podman-restart.service` runs `podman start --all --filter restart-policy=always`. A container created with `unless-stopped` **does not match that filter** and silently never restarts, even with linger enabled and the service showing `active (exited)` with no errors. Use `--restart=always` for every rootless container on these VMs — the `podman-postgres` skill's own recipe needs this correction too.

### Add a project's database

See the recipe in [../SKILL.md](../SKILL.md). Give each project a distinct host port when running more than one Postgres on the box.

## dev-builder (VMID 201)

Purpose: run heavy `pnpm install` / typecheck / test / Playwright work on real hardware instead of the workstation, to stay under its load-average ceiling.

Suggested size: 6 vCPU / 12 GB RAM / 80 GB disk, static IP. Install `git`, `gh`, `fnm`, and `pnpm` (via `corepack`) plus a Node LTS.

**GitHub auth:** `gh` over HTTPS, not SSH keys. SSH agent forwarding is unnecessary and often doesn't work here (GitHub's host key isn't trusted from an account that has only ever used HTTPS). To (re-)authenticate from a logged-in workstation:

```sh
gh auth token | ssh dev-builder 'gh auth login --with-token && gh auth setup-git'
```

**`fnm` doesn't work via plain `ssh host 'cmd'`** — Ubuntu's `~/.bashrc` returns immediately for non-interactive shells, so the `fnm env` line never runs. Load it explicitly:

```sh
ssh dev-builder '
export PATH="$HOME/.local/share/fnm:$PATH"
eval "$(fnm env --use-on-cd)"
cd ~/projects/<repo>
pnpm install --frozen-lockfile
pnpm test
'
```

**Workflow for a real worktree task:** `gh repo clone <org>/<repo>` into `~/projects/` on the VM, run whatever the repo's PR-checklist / E2E steps need there, read results back over SSH. For Playwright, install system deps per-repo (`npx playwright install --with-deps`) rather than baking one pinned version into the golden image.

## llm-server (VMID 300) — GPU passthrough for local LLMs

Purpose: run open-source LLMs (Ollama + Open WebUI) with GPU acceleration, using the host's discrete GPU via PCI passthrough instead of CPU-only inference.

Suggested size: 8 vCPU / 32 GB RAM / 150 GB disk, static IP, cloned from the same golden template. The rest of this section is written for an **AMD** GPU (RDNA3-class, in the Navi 31 / `gfx1100` family); an NVIDIA card follows the same host-side steps with a different in-guest driver stack.

### Prerequisites and checks

- The host needs a discrete GPU (an iGPU-less CPU is fine, since the host is headless).
- **Check IOMMU groups** — the GPU (`<gpu-pci>.0`) and its audio function (`<gpu-pci>.1`) should each sit alone in their group. If they do, no ACS-override patching is needed.
- Find the PCI addresses and vendor:device IDs with `lspci -nn | grep -i -E 'vga|audio'`.

### Host-side setup

```sh
# Enable IOMMU and bind the GPU's PCI IDs to vfio-pci at boot
ssh proxmox '
sed -i "s/GRUB_CMDLINE_LINUX_DEFAULT=\"quiet\"/GRUB_CMDLINE_LINUX_DEFAULT=\"quiet amd_iommu=on iommu=pt\"/" /etc/default/grub
update-grub
printf "vfio\nvfio_iommu_type1\nvfio_pci\nvfio_virqfd\n" > /etc/modules-load.d/vfio.conf
echo "options vfio-pci ids=<gpu-vendor:device>,<audio-vendor:device>" > /etc/modprobe.d/vfio.conf
update-initramfs -u -k all
qm set 200 --onboot 1; qm set 201 --onboot 1; qm set 300 --onboot 1   # VMs auto-resume after host reboot
reboot
'
# after reboot: both GPU functions should show "Kernel driver in use: vfio-pci"
ssh proxmox 'lspci -nnk -s <gpu-pci>.0; lspci -nnk -s <gpu-pci>.1'

# attach the GPU to the VM (must be stopped first) — read the OVMF gotcha BEFORE doing this on a SeaBIOS VM
ssh proxmox '
qm shutdown 300 --timeout 30
qm set 300 --bios ovmf --machine q35
qm set 300 --efidisk0 local-lvm:1,efitype=4m,pre-enrolled-keys=1
qm set 300 -hostpci0 <gpu-pci>,pcie=1
qm start 300
'
```

(Use `intel_iommu=on` instead of `amd_iommu=on` on an Intel host.)

### In-guest setup (`ssh llm-server`)

Verify current steps at <https://rocm.docs.amd.com/projects/install-on-linux/> before running — they change between releases. If your Ubuntu release isn't on AMD's supported-OS list yet, the previous LTS's `amdgpu-install` package generally still installs and runs cleanly:

```sh
wget https://repo.radeon.com/amdgpu-install/latest/ubuntu/<supported-codename>/amdgpu-install_<version>_all.deb
sudo apt install -y ./amdgpu-install_<version>_all.deb
sudo amdgpu-install -y --usecase=rocm --no-dkms
sudo apt-get install -y linux-firmware   # see gotcha below — this is the step that actually makes the GPU initialize
sudo usermod -aG render,video <user>
sudo reboot
# after reboot:
/opt/rocm/bin/rocm-smi                   # should show the card, not an empty table
sudo systemctl restart ollama
journalctl -u ollama -n 10 --no-pager    # should show "inference compute" naming the GPU, not CPU-only
```

### What runs on it

- **Ollama** — native systemd service with `OLLAMA_HOST=0.0.0.0`, port `11434`. On AMD, recent Ollama releases go through Mesa's **Vulkan (RADV)** driver rather than HIP/ROCm directly. ROCm is still worth installing for `rocm-smi`/`rocminfo` and for other AI tooling, but Ollama itself may not need the HIP runtime once Vulkan sees the card.
- **Open WebUI** — rootless podman container, `--restart=always`, port `8080`.

### Gotcha: SeaBIOS hangs passing through a modern GPU — use OVMF + q35

The VM's default SeaBIOS/i440fx config (from the cloud-init template) boots to `running` per `qm status`, but the guest agent never comes up and the serial console produces no output — a silent hang, not a crash. Modern GPUs generally ship UEFI-only GOP firmware with no legacy VBIOS fallback; SeaBIOS probing the option ROM during POST is a well-known hang. Fix — switch to OVMF plus an EFI vars disk, and q35 (required for `pcie=1`; i440fx has no PCIe root):

```sh
qm set 300 --bios ovmf --machine q35
qm set 300 --efidisk0 local-lvm:1,efitype=4m,pre-enrolled-keys=1
```

This works on the existing disk without a reinstall — Ubuntu's cloud images ship a GPT layout with both a BIOS-boot partition and an ESP precisely so they boot either way. **If a GPU-passthrough VM hangs with `running` status, no guest-agent response, and a silent serial console, suspect SeaBIOS-vs-GPU-firmware before anything else.** Don't spend time debugging vfio/IOMMU config.

Harmless after the switch: `shpchp … pci_hp_register failed with error -16` for unused PCI bridge slots q35 creates by default. Cosmetic.

### Gotcha: GPU driver "detected" but never binds — missing `linux-firmware`

After OVMF fixes the boot hang, `lspci -nnk` may show `Kernel modules: amdgpu` but **no** `Kernel driver in use` line — the module never attached, even across reboots. `dmesg` tells the real story: `Direct firmware load for amdgpu/psp_….bin failed with error -2`, repeated for every IP block (`smu`, `dm`, `gfx`, `sdma`, `vcn`, `mes`), ending in `Fatal error during GPU init`.

Root cause: **`linux-firmware` isn't installed at all** — the cloud image is minimal and `amdgpu-install`'s ROCm usecase doesn't pull it in. Fix:

```sh
sudo apt-get install -y linux-firmware
sudo reboot
```

**On any GPU-passthrough VM built from a minimal cloud image, install `linux-firmware` before troubleshooting anything else.** A loaded-but-unbound driver with `error -2` firmware lines in `dmesg` is this bug, not a passthrough or IOMMU problem.

### Gotcha: rootless `podman run --network host` segfaults

`--network host` crashed on container stop with a nil-pointer panic inside `storageService.UnmountContainerImage`, and corrupted rootless storage badly enough that `podman system migrate` panicked too — recovery needed `podman system reset --force`. **Use `-p <port>:<port>` publishing instead.**

### Gotcha: a rootless container can't reach its host's own LAN IP — use `host.containers.internal`

With `OLLAMA_BASE_URL=http://<vm-ip>:11434` (the VM's own LAN address), Open WebUI's model list stays empty and its logs show a clean **connection refused** — not a timeout. The host itself can `curl` that URL fine, and `podman exec <container> curl <same url>` fails, so it isn't a firewall: rootless netavark doesn't hairpin a container's outbound traffic back to the host's external interface IP. Use podman's built-in host alias, which *is* routed correctly from inside the container:

```
OLLAMA_BASE_URL=http://host.containers.internal:11434
```

The VM's LAN IP is still correct for reaching Ollama from *other* machines (workstation, other VMs) — this only affects a container calling back out to its own host.

Also: Open WebUI persists the Ollama URL in its database after the first successful save, so a changed `OLLAMA_BASE_URL` env var on container recreate is silently ignored. Fix a wrong stored URL via Admin Settings → Connections in the UI, not just the env var.

### Gotcha: no signup form on first visit — a stale admin account in the volume

Symptom: a "fresh" Open WebUI container shows only a Sign-in form, no signup or onboarding. The real cause was an old `open-webui` named volume that already had an admin user seeded into it — Open WebUI was behaving correctly. Check the DB directly (the image has no `sqlite3` binary, so use its own Python):

```sh
podman exec open-webui python3 -c "
import sqlite3
con = sqlite3.connect('/app/backend/data/webui.db')
cur = con.cursor()
cur.execute('select id,email,role,created_at from user')
print(cur.fetchall())
"
```

If a user row exists and every content table (`chat`, `message`, `model`, `knowledge`, `note`, `file`) is empty, there's nothing to lose — recreate with a clean volume:

```sh
podman stop open-webui && podman rm open-webui && podman volume rm open-webui
podman run -d --name open-webui --restart=always \
  -p 0.0.0.0:8080:8080 \
  -v open-webui:/app/backend/data \
  -e OLLAMA_BASE_URL=http://host.containers.internal:11434 \
  ghcr.io/open-webui/open-webui:main
```

Then `/api/config` should show `"onboarding": true`. **Before assuming a signup-suppression bug or env-var misconfig, check the DB for an existing user row first.**

Not a bug: recent Open WebUI versions open on a marketing splash with a small Sign-in form embedded below it for returning users; the real "Create Admin Account" form only appears after clicking **Get started**. Check `/api/config`'s `onboarding` field or click through before concluding anything is broken.

### Gotcha: linger and `--restart=always`, again

Same two root causes as the `dev-postgres` gotchas above — hit them again here before remembering to check. On any new VM that will run rootless containers: enable linger first, and use `--restart=always`.

### Model capacity

Size models to your card's VRAM. As a rule of thumb, a 20 GB card comfortably fits up to ~30B-class models at Q4 quantization; 70B-class models need aggressive quantization and will be tight. Pull additional models with `ssh llm-server 'ollama pull <model>'` — Open WebUI picks them up automatically via Ollama's `/api/tags`, with no separate registration step.

## Migrating an existing project's DB to dev-postgres

A deliberate, per-repo choice made only on explicit request — it touches `.env.local` and may need existing local data moved via `pg_dump`/`pg_restore`. The step-by-step recipe is in [../SKILL.md](../SKILL.md).
