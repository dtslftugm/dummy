# ======================================================================
# SCRIPT: lab-logic.ps1 (Update 2026-03-22)
# FUNGSI: Mengirimkan heartbeat dan spesifikasi hardware ke GAS API
# ======================================================================

# --- CONFIGURATION ---
$gasUrl = "https://script.google.com/macros/s/AKfycbxG2MVcqRMqL-KX7MASHYNeOS-Py0Snf5PQeHuvgu7arITkGGbVgSAg6y8IZNjib3I9/exec" # GANTI DENGAN URL WEB APP INVENTORY ANDA
$hostname = $env:COMPUTERNAME
$hashFile = "$env:TEMP\dtsl_sw_hash.txt"

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

# --- CHECK PENDING REBOOT ---
$isRebootPending = $false
$regPaths = @("HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired", "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending")
foreach ($path in $regPaths) { if (Test-Path $path) { $isRebootPending = $true } }

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
}

if ($sendSoftware) { $payload.softwareList = $swList }

# --- SEND HEARTBEAT ---
try {
    Write-Host "Mengirim data inventory untuk $hostname..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri $gasUrl -Method Post -Body ($payload | ConvertTo-Json) -ContentType "application/json"
    if ($response.success) {
        Write-Host "Berhasil di-update ke Spreadsheet Inventory!" -ForegroundColor Green
    } else {
        Write-Host "Gagal: $($response.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
