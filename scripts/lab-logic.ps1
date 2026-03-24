# ======================================================================
# SCRIPT: lab-logic.ps1 (Update 2026-03-22)
# FUNGSI: Mengirimkan heartbeat dan spesifikasi hardware ke GAS API
# ======================================================================

# --- CONFIGURATION ---
$gasUrl = "https://script.google.com/macros/s/AKfycbxG2MVcqRMqL-KX7MASHYNeOS-Py0Snf5PQeHuvgu7arITkGGbVgSAg6y8IZNjib3I9/exec" 
$hostname = $env:COMPUTERNAME
$hashFile = "C:\Users\Public\Documents\DTSL\dtsl_sw_hash.txt"

# --- GET HARDWARE INFO (CIM Mode - Faster) ---
$cs = Get-CimInstance Win32_ComputerSystem
$os = Get-CimInstance Win32_OperatingSystem
$proc = Get-CimInstance Win32_Processor
$bios = Get-CimInstance Win32_Bios
$memArray = Get-CimInstance Win32_PhysicalMemoryArray
$memSum = (Get-CimInstance Win32_PhysicalMemory | Measure-Object Capacity -Sum).Sum / 1GB
$csp = Get-CimInstance Win32_ComputerSystemProduct
$chassis = Get-CimInstance Win32_SystemEnclosure

# Chassis Type Mapping
$chassisMap = @{ 3="Desktop"; 4="Low Profile Desktop"; 8="Portable"; 9="Laptop"; 10="Notebook"; 13="All in One" }
$systemType = if ($chassis.ChassisTypes[0]) { $chassisMap[[int]$chassis.ChassisTypes[0]] } else { "Unknown" }

# --- GET NETWORK INFO ---
$ips = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" }).IPAddress -join ", "
$macs = (Get-NetAdapter | Where-Object { $_.Status -eq "Up" }).MacAddress -join ", "

# --- CHECK PENDING REBOOT (Comprehensive) ---
$isRebootPending = $false
# 1. Common Registry Checks
$regPaths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending",
    "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\PendingFileRenameOperations"
)
foreach ($path in $regPaths) { if (Test-Path $path) { $isRebootPending = $true } }

# 2. Rename Check (Current vs Pending Name)
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

# --- GET INSTALLED SOFTWARE (Registry) ---
$paths = @("HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*")
$swRaw = Get-ItemProperty $paths -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -ne $null }
$swList = $swRaw | Select-Object @{n='name';e={$_.DisplayName}}, @{n='version';e={$_.DisplayVersion}}, @{n='vendor';e={$_.Publisher}}, @{n='installDate';e={$_.InstallDate}}

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
} elseif (Test-Path $tvPath32) {
    try { $teamviewerId = (Get-ItemProperty -Path $tvPath32 -Name "ClientID" -ErrorAction SilentlyContinue).ClientID } catch {}
}

# --- HASH CHECK (Sync Optimization) ---
$currentHash = ($swList | ConvertTo-Json | Out-String).GetHashCode().ToString()
$oldHash = if (Test-Path $hashFile) { Get-Content $hashFile } else { "" }
$sendSoftware = $false
if ($currentHash -ne $oldHash) {
    $sendSoftware = $true
    Set-Content -Path $hashFile -Value $currentHash
}

# --- PREPARE PAYLOAD ---
$payload = @{
    path                  = "record-activity"
    name                  = $hostname
    status                = $workStatus
    operating_system_name = $os.Caption
    processor_type        = $proc.Name.Trim()
    number_of_processors  = $cs.NumberOfProcessors
    memory_total_size     = "$([math]::Round($memSum, 2)) GB"
    memory_slot_count     = $memArray.MemoryDevices
    manufacturer          = $cs.Manufacturer
    model                 = $cs.Model
    serial_number         = $bios.SerialNumber
    uuid                  = $csp.UUID
    bios_version          = $bios.SMBIOSBIOSVersion
    bios_date             = $bios.ReleaseDate.ToString("yyyy-MM-dd")
    type                  = $systemType
    ip_addresses          = $ips
    mac_addresses         = $macs
    last_user             = $cs.UserName
    anydesk_id            = $anydeskId
    teamviewer_id         = $teamviewerId
}

if ($sendSoftware) { $payload.softwareList = $swList }

# --- SEND HEARTBEAT ---
try {
    Write-Host "Mengirim data inventory untuk $hostname..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri $gasUrl -Method Post -Body ($payload | ConvertTo-Json) -ContentType "application/json"
    if ($response.success) {
        Write-Host "Berhasil di-update ke Spreadsheet Inventory!" -ForegroundColor Green
        
        # --- HANDLE PENDING COMMANDS ---
        if ($response.pendingCommand) {
            $cmd = $response.pendingCommand.ToString()
            Write-Host "Menerima perintah: $cmd" -ForegroundColor Yellow
            
            if ($cmd -match "reset-anydesk:(.*)") {
                $newPass = $matches[1]
                $adExe = if (Test-Path "C:\Program Files (x86)\AnyDesk\AnyDesk.exe") { "C:\Program Files (x86)\AnyDesk\AnyDesk.exe" } else { "C:\Program Files\AnyDesk\AnyDesk.exe" }
                if (Test-Path $adExe) {
                    Write-Host "Mereset password AnyDesk via CMD pipe..." -ForegroundColor Gray
                    cmd /c "echo $newPass | `"$adExe`" --set-password"
                }
            }
            elseif ($cmd -eq "winrm-enable") {
                Write-Host "Mengaktifkan WinRM..." -ForegroundColor Gray
                Enable-PSRemoting -Force
            }
            elseif ($cmd -match "create-user:(.*):(.*)") {
                $rawName = $matches[1]
                $rawPass = $matches[2]
                
                # Sanitasi Nama (Maks 20 char, Alfanumerik saja)
                $cleanName = ($rawName -replace '[^a-zA-Z0-9]', '')
                if ($cleanName.Length -gt 20) { $cleanName = $cleanName.Substring(0, 20) }
                
                if ($cleanName -and !(Get-LocalUser -Name $cleanName -ErrorAction SilentlyContinue)) {
                    Write-Host "Membuat user baru: $cleanName..." -ForegroundColor Cyan
                    $secPass = ConvertTo-SecureString $rawPass -AsPlainText -Force
                    New-LocalUser -Name $cleanName -Password $secPass -FullName $rawName -Description "DTSL Auto-Provisioned"
                    Add-LocalGroupMember -Group "Administrators" -Member $cleanName
                    Write-Host "User $cleanName berhasil dibuat & diset sebagai Admin." -ForegroundColor Green
                }
            }
        }
    } else {
        Write-Host "Gagal: $($response.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
