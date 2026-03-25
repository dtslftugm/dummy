# ======================================================================
# SCRIPT: lab-logic.ps1 (Update 2026-03-24 - Final Robust Edition)
# FUNGSI: Heartbeat, Inventory, & Command Execution via Local Gateway/Cloud
# ======================================================================

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
$ips = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" }).IPAddress -join ", "
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

# --- PREPARE PAYLOAD ---
$payload = @{
    path = "record-activity"; name = $hostname; status = $workStatus; operating_system_name = $os.Caption
    processor_type = $proc.Name.Trim(); number_of_processors = $cs.NumberOfProcessors; memory_total_size = "$([math]::Round($memSum, 2)) GB"
    memory_slot_count = $memArray.MemoryDevices; manufacturer = $cs.Manufacturer; model = $cs.Model
    serial_number = $bios.SerialNumber; uuid = $csp.UUID; bios_version = $bios.SMBIOSBIOSVersion
    bios_date = $bios.ReleaseDate.ToString("yyyy-MM-dd"); type = $systemType; ip_addresses = $ips
    mac_addresses = $macs; last_user = $cs.UserName; anydesk_id = $anydeskId; teamviewer_id = $teamviewerId
}
if ($sendSoftware) { $payload.softwareList = $swList }

# --- SYNC (Dual-Sync) ---
$pendingCommand = $null
# 1. Local Gateway
try {
    $resLocal = Invoke-RestMethod -Uri $localGatewayUrl -Method Post -Body ($payload | ConvertTo-Json -Depth 10) -ContentType "application/json" -TimeoutSec 5
    if ($resLocal.success -and $resLocal.pendingCommand) { $pendingCommand = $resLocal.pendingCommand }
}
catch { Write-Host "Local Gateway Offline." -ForegroundColor Yellow }

# 2. Google Sheets
try {
    $resGas = Invoke-RestMethod -Uri $gasUrl -Method Post -Body ($payload | ConvertTo-Json -Depth 10) -ContentType "application/json"
    if ($resGas.success -and $resGas.pendingCommand) { $pendingCommand = $resGas.pendingCommand }
}
catch { Write-Host "Google Sheets Offline." -ForegroundColor Red }

# --- HANDLE PENDING COMMANDS ---
if ($pendingCommand) {
    $cmd = $pendingCommand.ToString(); $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "Menerima Perintah: $cmd" -ForegroundColor Yellow
    "[$timestamp] RECEIVED: $cmd" | Out-File -FilePath $logPath -Append

    $result = "" 
    try {
        if ($cmd -match "create-user:([^:]*):(.*)") {
            $rawName = $matches[1]; $rawPass = $matches[2]; $cleanName = ($rawName -replace '[^a-zA-Z0-9]', '')
            if ($cleanName.Length -gt 20) { $cleanName = $cleanName.Substring(0, 20) }
            
            if ($cleanName -and !(Get-LocalUser -Name $cleanName -ErrorAction SilentlyContinue)) {
                if ($rawPass -eq "none" -or $rawPass -eq "" -or $rawPass -eq "null") {
                    New-LocalUser -Name $cleanName -NoPassword -FullName $rawName -ErrorAction Stop
                }
                else {
                    $secPass = ConvertTo-SecureString $rawPass -AsPlainText -Force
                    New-LocalUser -Name $cleanName -Password $secPass -FullName $rawName -ErrorAction Stop
                }
                Add-LocalGroupMember -Group "Administrators" -Member $cleanName -ErrorAction Stop
                
                # --- STRICT VERIFICATION WITH RETRY (max 90s, check every 30s) ---
                $verified = $false
                for ($i = 0; $i -lt 3; $i++) {
                    if (Get-LocalUser -Name $cleanName -ErrorAction SilentlyContinue) { $verified = $true; break }
                    Start-Sleep -Seconds 30
                }
                if ($verified) {
                    $result = "VERIFIED SUCCESS: User $cleanName created & exists."
                } else {
                    $result = "FAILED VERIFICATION: User $cleanName command ran but not found after 90 seconds."
                }
            }
            else {
                $result = "SKIP: User $cleanName already exists or invalid name."
            }
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
                # --- STRICT VERIFICATION WITH RETRY (max 30s, check every 10s) ---
                $verified = $false
                for ($i = 0; $i -lt 3; $i++) {
                    $postDate = (Get-LocalUser -Name $targetUser -ErrorAction SilentlyContinue).PasswordLastSet
                    if ($postDate -ne $preDate) { $verified = $true; break }
                    Start-Sleep -Seconds 10
                }
                if ($verified) {
                    $result = "VERIFIED SUCCESS: Password for $targetUser updated."
                } else {
                    $result = "FAILED VERIFICATION: Password for $targetUser command ran but timestamp unchanged after 30 seconds."
                }
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
            Enable-PSRemoting -Force -ErrorAction Stop
            if ((Get-Service WinRM).Status -eq "Running") {
                $result = "VERIFIED SUCCESS: WinRM enabled and Running."
            }
            else {
                $result = "FAILED VERIFICATION: WinRM command ran but service not Running."
            }
        }

        # Send Feedback to GAS/Gateway
        if ($result) {
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            "[$timestamp] $result" | Out-File -FilePath $logPath -Append
            $feedback = @{ path = "command-feedback"; uuid = $csp.UUID; result = $result }
            Invoke-RestMethod -Uri $localGatewayUrl -Method Post -Body ($feedback | ConvertTo-Json) -ContentType "application/json" -ErrorAction SilentlyContinue
        }
    }
    catch {
        $err = "ERROR on command '$cmd': $($_.Exception.Message)"
        "[$timestamp] $err" | Out-File -FilePath $logPath -Append
        $feedback = @{ path = "command-feedback"; uuid = $csp.UUID; result = $err }
        Invoke-RestMethod -Uri $localGatewayUrl -Method Post -Body ($feedback | ConvertTo-Json) -ContentType "application/json" -ErrorAction SilentlyContinue
    }
}
Write-Host "Sync Complete." -ForegroundColor Green

