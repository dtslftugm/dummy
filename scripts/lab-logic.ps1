# ======================================================================
# SCRIPT: lab-logic.ps1 (Update 2026-03-26 - Final Robust Edition)
# FUNGSI: Heartbeat, Inventory, & Command Execution via Local Gateway/Cloud
# ======================================================================
# =============================================================================
# DAFTAR PERINTAH YANG TERSEDIA (pending_command di sheet Devices)
# Gunakan pipe "|" untuk menggabungkan beberapa perintah sekaligus.
#
# SYNTAX PERINTAH TUNGGAL:
#   create-user:<nama_user>:<password>
#       Membuat user lokal baru sebagai Administrator.
#       Password "none" = user tanpa password.
#       Contoh: create-user:LABKOMP:Tsipil#1!
#
#   reset-password:<nama_user>:<password_baru>
#       Mengubah password user lokal yang sudah ada.
#       Password "none" = hapus password (no password).
#       Contoh: reset-password:LABKOMP:NewPass123
#
#   reset-anydesk:<password_baru>
#       Mengatur ulang password AnyDesk pada unit ini.
#       Contoh: reset-anydesk:AnyDeskPass!
#
#   winrm-enable
#       Mengaktifkan Windows Remote Management (PSRemoting).
#       Contoh: winrm-enable
#
#   rename-computer:<nama_baru>
#       Mengganti hostname unit komputer. Membutuhkan restart.
#       Tempatkan di akhir antrian perintah.
#       Contoh: rename-computer:FT-DTSL-PC-01
#
#   restart
#       Merestart komputer secara remote (delay 15 detik).
#       Hanya dieksekusi bila komputer IDLE (tidak ada user login aktif
#       dan tidak ada aplikasi office/editor yang berjalan).
#       SELALU tempatkan di posisi PALING AKHIR dalam antrian.
#       Contoh: rename-computer:FT-DTSL-PC-01|restart
#
# FEEDBACK: Setiap perintah menghasilkan status bernomor [N/M] di kolom
#   last_command_result pada sheet Devices.
# =============================================================================

# --- CONFIGURATION ---
$gasUrl = "https://script.google.com/macros/s/AKfycbxG2MVcqRMqL-KX7MASHYNeOS-Py0Snf5PQeHuvgu7arITkGGbVgSAg6y8IZNjib3I9/exec"
$localGatewayUrl = "http://10.47.106.9:5000/inventory"
$hostname = [System.Net.Dns]::GetHostName()
$hashFile = "C:\Users\Public\Documents\DTSL\dtsl_sw_hash.txt"
$logPath = "C:\Users\Public\Documents\DTSL\command_log.txt"

# Ensure log directory exists
if (!(Test-Path "C:\Users\Public\Documents\DTSL")) { New-Item -ItemType Directory -Path "C:\Users\Public\Documents\DTSL" -Force }

# --- GET HARDWARE INFO ---
$cs = Get-CimInstance Win32_ComputerSystem
$os = Get-CimInstance Win32_OperatingSystem
$proc = Get-CimInstance Win32_Processor
$bios = Get-CimInstance Win32_Bios
$memArray = Get-CimInstance Win32_PhysicalMemoryArray
$memSum = (Get-CimInstance Win32_PhysicalMemory | Measure-Object Capacity -Sum).Sum / 1GB
$csp = Get-CimInstance Win32_ComputerSystemProduct
$chassis = Get-CimInstance Win32_SystemEnclosure
$chassisMap = @{ 3 = "Desktop"; 4 = "Low Profile Desktop"; 8 = "Portable"; 9 = "Laptop"; 10 = "Notebook"; 13 = "All in One" }
$systemType = if ($chassis.ChassisTypes[0]) { $chassisMap[[int]$chassis.ChassisTypes[0]] } else { "Unknown" }

# --- GET NETWORK INFO ---
$ips = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254*" }).IPAddress -join ", "
$macs = (Get-NetAdapter | Where-Object { $_.Status -eq "Up" }).MacAddress -join ", "

# --- CHECK PENDING REBOOT ---
$isRebootPending = $false
$regPaths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending",
    "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\PendingFileRenameOperations"
)
foreach ($path in $regPaths) { if (Test-Path $path) { $isRebootPending = $true } }
$activeName = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\ComputerName\ActiveComputerName").ComputerName
$pendingName = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\ComputerName\ComputerName").ComputerName
if ($activeName -ne $pendingName) { $isRebootPending = $true }

# Disk Check
$cDrive = Get-WmiObject Win32_LogicalDisk | Where-Object { $_.DeviceID -eq "C:" }
$percentFree = [math]::Round(($cDrive.FreeSpace / $cDrive.Size) * 100, 2)
$alerts = @()
if ($isRebootPending) { $alerts += "Reboot Required" }
if ($percentFree -lt 13) { $alerts += "Low Disk: $percentFree%" }
$workStatus = if ($alerts.Count -gt 0) { "Active (" + ($alerts -join ", ") + ")" } else { "Active" }

# --- GET REMOTE ACCESS IDs ---
$anydeskId = "N/A"
$anydeskConf = "C:\ProgramData\AnyDesk\system.conf"
if (Test-Path $anydeskConf) {
    $anydeskId = (Select-String -Path $anydeskConf -Pattern "ad.anynet.id" | ForEach-Object { $_.Line.Split('=')[1].Trim() })
}
$teamviewerId = "N/A"
$tvPath64 = "HKLM:\SOFTWARE\TeamViewer"
$tvPath32 = "HKLM:\SOFTWARE\WOW6432Node\TeamViewer"
if (Test-Path $tvPath64) {
    try { $teamviewerId = (Get-ItemProperty -Path $tvPath64 -Name "ClientID" -ErrorAction SilentlyContinue).ClientID } catch {}
}
elseif (Test-Path $tvPath32) {
    try { $teamviewerId = (Get-ItemProperty -Path $tvPath32 -Name "ClientID" -ErrorAction SilentlyContinue).ClientID } catch {}
}

# --- GET INSTALLED SOFTWARE ---
$paths = @("HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*")
$swRaw = Get-ItemProperty $paths -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -ne $null }
$swList = $swRaw | Select-Object @{n = 'name'; e = { $_.DisplayName } }, @{n = 'version'; e = { $_.DisplayVersion } }, @{n = 'vendor'; e = { $_.Publisher } }, @{n = 'installDate'; e = { $_.InstallDate } }

# Hash sync check
$currentHash = ($swList | ConvertTo-Json | Out-String).GetHashCode().ToString()
$oldHash = if (Test-Path $hashFile) { Get-Content $hashFile } else { "" }
$sendSoftware = if ($currentHash -ne $oldHash) { $true } else { $false }
if ($sendSoftware) { Set-Content -Path $hashFile -Value $currentHash }

# --- DETECT HEAVY PROCESSES (>10% CPU) ---
$numCores = $env:NUMBER_OF_PROCESSORS
if (!$numCores) { $numCores = 1 }

$p1 = Get-Process | Select-Object Id, Name, CPU
Start-Sleep -Seconds 2
$p2 = Get-Process | Select-Object Id, Name, CPU

$heavyApps = @()
foreach ($proc2 in $p2) {
    if ($null -eq $proc2.CPU) { continue }
    
    $proc1 = $p1 | Where-Object { $_.Id -eq $proc2.Id }
    if ($proc1 -and $null -ne $proc1.CPU) {
        $usage = (($proc2.CPU - $proc1.CPU) / 2 / $numCores) * 100
        if ($usage -gt 10 -and $proc2.Name -notmatch "Idle|System") {
            $heavyApps += "$($proc2.Name) ($([math]::Round($usage, 1))%)"
        }
    }
}

if ($heavyApps.Count -gt 0) {
    $debugPayload = @{ path = "record-debug"; action = "HeavyProcesses"; payload = @{ name = $hostname; list = ($heavyApps -join ", "); timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss") } }
    Invoke-RestMethod -Uri $gasUrl -Method Post -Body ($debugPayload | ConvertTo-Json) -ContentType "application/json" -ErrorAction SilentlyContinue
}

# --- GET ACTIVE USER (Aggressive Detection) ---
$activeUser = (Get-CimInstance Win32_Process -Filter "Name='explorer.exe'" | Invoke-CimMethod -MethodName GetOwner -ErrorAction SilentlyContinue | Select-Object -First 1).User
if (!$activeUser) { $activeUser = $cs.UserName }

# --- PREPARE PAYLOAD ---
$payload = @{
    path = "record-activity"; name = $hostname; status = $workStatus; operating_system_name = $os.Caption
    processor_type = $proc.Name.Trim(); number_of_processors = $cs.NumberOfProcessors; memory_total_size = "$([math]::Round($memSum, 2)) GB"
    memory_slot_count = $memArray.MemoryDevices; manufacturer = $cs.Manufacturer; model = $cs.Model
    serial_number = $bios.SerialNumber; uuid = $csp.UUID; bios_version = $bios.SMBIOSBIOSVersion
    bios_date = $bios.ReleaseDate.ToString("yyyy-MM-dd"); type = $systemType; ip_addresses = $ips
    mac_addresses = $macs; last_user = $activeUser; anydesk_id = $anydeskId; teamviewer_id = $teamviewerId
}
if ($sendSoftware) { $payload.softwareList = $swList }

# --- SYNC (Dual-Sync) ---
$pendingCommand = $null

# 1. Local Gateway (primary — forwards heartbeat to GAS and relays pendingCommand)
try {
    $resLocal = Invoke-RestMethod -Uri $localGatewayUrl -Method Post -Body ($payload | ConvertTo-Json -Depth 10) -ContentType "application/json" -TimeoutSec 5
    if ($resLocal.success -and $resLocal.pendingCommand) { $pendingCommand = $resLocal.pendingCommand }
}
catch { Write-Host "Local Gateway Offline." -ForegroundColor Yellow }

# 2. Google Sheets (fallback — hanya dipanggil jika gateway offline atau tidak ada command)
if (-not $pendingCommand) {
    try {
        $resGas = Invoke-RestMethod -Uri $gasUrl -Method Post -Body ($payload | ConvertTo-Json -Depth 10) -ContentType "application/json"
        if ($resGas.success -and $resGas.pendingCommand) { $pendingCommand = $resGas.pendingCommand }
    }
    catch { Write-Host "Google Sheets Offline." -ForegroundColor Red }
}


# --- EXECUTE PENDING COMMANDS ---
if ($pendingCommand) {
    $queueFile = "C:\Users\Public\Documents\DTSL\command_queue.json"
    $cmdList = $pendingCommand.ToString() -split '\|' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
    $total = $cmdList.Count
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    Write-Host "Menerima $total Perintah." -ForegroundColor Yellow
    "[$timestamp] QUEUE RECEIVED ($total): $($cmdList -join ' | ')" | Out-File -FilePath $logPath -Append
    $cmdList | ConvertTo-Json | Set-Content -Path $queueFile

    $allResults = @()
    $cmdIndex = 0

    foreach ($cmd in $cmdList) {
        $cmdIndex++
        $prefix = "[$cmdIndex/$total]"
        $result = ""

        try {
            if ($cmd -match "create-user:([^:]*):(.*)") {
                $rawName = $matches[1]; $rawPass = $matches[2]
                $cleanName = ($rawName -replace '[^a-zA-Z0-9]', '')
                if ($cleanName.Length -gt 20) { $cleanName = $cleanName.Substring(0, 20) }

                if ($cleanName) {
                    # Cek status keberadaan user
                    $userObj = Get-LocalUser -Name $cleanName -ErrorAction SilentlyContinue
                    
                    if (!$userObj) {
                        # Create User
                        if ($rawPass -eq "none" -or $rawPass -eq "" -or $rawPass -eq "null") {
                            New-LocalUser -Name $cleanName -NoPassword -FullName $rawName -ErrorAction Stop
                        }
                        else {
                            $secPass = ConvertTo-SecureString $rawPass -AsPlainText -Force
                            New-LocalUser -Name $cleanName -Password $secPass -FullName $rawName -ErrorAction Stop
                        }
                        Add-LocalGroupMember -Group "Administrators" -Member $cleanName -ErrorAction Stop

                        # Verification loop
                        for ($i = 0; $i -lt 3; $i++) {
                            $userObj = Get-LocalUser -Name $cleanName -ErrorAction SilentlyContinue
                            if ($userObj) { break }
                            Start-Sleep -Seconds 30
                        }
                        $result = if ($userObj) { "VERIFIED SUCCESS: User $cleanName created." } else { "FAILED: User not found." }
                    }
                    else {
                        $result = "SKIP: User $cleanName already exists."
                    }

                    # --- AUTO INIT PROFILE (Unified) ---
                    # Dijalankan hanya jika user ada (baru/lama), password tersedia, dan folder belum ada.
                    if ($userObj -and $rawPass -ne "none" -and $rawPass -ne "" -and $rawPass -ne "null" -and -not (Test-Path "C:\Users\$cleanName")) {
                        try {
                            $secPass = ConvertTo-SecureString $rawPass -AsPlainText -Force
                            $cred = New-Object System.Management.Automation.PSCredential($cleanName, $secPass)
                            Start-Process "cmd.exe" -ArgumentList "/c exit" -Credential $cred -WindowStyle Hidden
                            $result += " Profile initialization triggered."
                        }
                        catch { $result += " Profile init failed: $($_.Exception.Message)" }
                    }
                }
                else { $result = "ERROR: Nama user tidak valid." }
            }
            elseif ($cmd -match "reset-password:([^:]*):(.*)") {
                $targetUser = $matches[1]; $newPass = $matches[2]
                $u = Get-LocalUser -Name $targetUser -ErrorAction SilentlyContinue
                if ($u) {
                    $preDate = $u.PasswordLastSet
                    if ($newPass -eq "none" -or $newPass -eq "" -or $newPass -eq "null") {
                        Set-LocalUser -Name $targetUser -Password $null -ErrorAction Stop
                    }
                    else {
                        $secPass = ConvertTo-SecureString $newPass -AsPlainText -Force
                        Set-LocalUser -Name $targetUser -Password $secPass -ErrorAction Stop
                    }
                    # Retry verification (max 30s, every 10s)
                    $verified = $false
                    for ($i = 0; $i -lt 3; $i++) {
                        $postDate = (Get-LocalUser -Name $targetUser -ErrorAction SilentlyContinue).PasswordLastSet
                        if ($postDate -ne $preDate) { $verified = $true; break }
                        Start-Sleep -Seconds 10
                    }
                    $result = if ($verified) { "VERIFIED SUCCESS: Password for $targetUser updated." } else { "FAILED VERIFICATION: Password for $targetUser unchanged after 30 seconds." }
                }
                else { $result = "ERROR: User $targetUser not found." }
            }
            elseif ($cmd -match "reset-anydesk:(.*)") {
                $newPass = $matches[1]
                $adExe = if (Test-Path "C:\Program Files (x86)\AnyDesk\AnyDesk.exe") { "C:\Program Files (x86)\AnyDesk\AnyDesk.exe" } else { "C:\Program Files\AnyDesk\AnyDesk.exe" }
                if (Test-Path $adExe) {
                    cmd /c "echo $newPass | `"$adExe`" --set-password"
                    $result = "VERIFIED SUCCESS: AnyDesk password set command sent."
                }
                else { $result = "ERROR: AnyDesk not installed." }
            }
            elseif ($cmd -eq "winrm-enable") {
                # Enable PSRemoting
                Enable-PSRemoting -Force -SkipNetworkProfileCheck -ErrorAction Stop
                # Fix LocalAccountTokenFilterPolicy for Workgroup remote admin
                $regPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
                Set-ItemProperty -Path $regPath -Name "LocalAccountTokenFilterPolicy" -Value 1 -Type DWord -Force
                
                if ((Get-Service WinRM).Status -eq "Running") {
                    $result = "VERIFIED SUCCESS: WinRM enabled, Running, & Policy set."
                } else {
                    $result = "FAILED VERIFICATION: WinRM service not Running."
                }
            }
            elseif ($cmd -match "rename-computer:(.*)") {
                $newName = $matches[1].Trim() -replace '[^a-zA-Z0-9\-]', ''
                if ($newName.Length -gt 0 -and $newName.Length -le 15) {
                    Rename-Computer -NewName $newName -Force -ErrorAction Stop
                    $result = "VERIFIED SUCCESS: Hostname akan menjadi '$newName' setelah restart."
                }
                else {
                    $result = "ERROR: Nama komputer '$newName' tidak valid (maks 15 karakter, alfanumerik dan tanda hubung)."
                }
            }
            elseif ($cmd -eq "restart") {
                # Cek apakah ada user yang aktif login (Aggressive Detection)
                $activeUser = (Get-CimInstance Win32_Process -Filter "Name='explorer.exe'" | Invoke-CimMethod -MethodName GetOwner -ErrorAction SilentlyContinue | Select-Object -First 1).User
                if (!$activeUser) { $activeUser = (Get-CimInstance Win32_ComputerSystem).UserName }
                
                # Cek apakah ada aplikasi office/editor yang berjalan
                $riskyProcs = @("WINWORD", "EXCEL", "POWERPNT", "notepad", "Code", "devenv", "OUTLOOK")
                $openApps = Get-Process -ErrorAction SilentlyContinue | Where-Object { $riskyProcs -contains $_.ProcessName }

                if ($activeUser -and $activeUser -ne "") {
                    $result = "ABORTED: User '$activeUser' masih login aktif. Restart dibatalkan."
                }
                elseif ($openApps) {
                    $appList = ($openApps.ProcessName | Sort-Object -Unique) -join ", "
                    $result = "ABORTED: Aplikasi '$appList' masih berjalan. Restart dibatalkan."
                }
                else {
                    # Kirim feedback partial ke GAS sebelum restart
                    $partialResults = $allResults + "[$cmdIndex/$total] Restarting in 15 seconds..."
                    $partialFb = @{ path = "command-feedback"; uuid = $csp.UUID; result = ($partialResults -join "`n") }
                    Invoke-RestMethod -Uri $gasUrl -Method Post -Body ($partialFb | ConvertTo-Json) -ContentType "application/json" -ErrorAction SilentlyContinue
                    shutdown /r /t 15 /c "DTSL Inventory Remote Restart"
                    $result = "Restarting in 15 seconds..."
                    $allResults += "[$cmdIndex/$total] $result"
                    Remove-Item -Path $queueFile -Force -ErrorAction SilentlyContinue
                    break
                }
            }
            else {
                $result = "UNKNOWN COMMAND: $cmd"
            }
        }
        catch {
            $result = "ERROR on '$cmd': $($_.Exception.Message)"
        }

        $numbered = "$prefix $result"
        $allResults += $numbered
        $ts2 = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "[$ts2] $numbered" | Out-File -FilePath $logPath -Append
        Write-Host $numbered -ForegroundColor $(if ($result -match "SUCCESS") { "Green" } elseif ($result -match "SKIP") { "Cyan" } else { "Red" })
    }

    # Kirim feedback ke GAS
    $combinedResult = $allResults -join "`n"
    $feedback = @{ path = "command-feedback"; uuid = $csp.UUID; result = $combinedResult }
    Invoke-RestMethod -Uri $gasUrl -Method Post -Body ($feedback | ConvertTo-Json) -ContentType "application/json" -ErrorAction SilentlyContinue

    # Hapus queue file setelah selesai
    Remove-Item -Path $queueFile -Force -ErrorAction SilentlyContinue
}

Write-Host "Sync Complete." -ForegroundColor Green
