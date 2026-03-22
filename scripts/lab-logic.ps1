# ======================================================================
# SCRIPT: lab-logic.ps1 (Update 2026-03-22)
# FUNGSI: Mengirimkan heartbeat dan spesifikasi hardware ke GAS API
# ======================================================================

# --- CONFIGURATION ---
$gasUrl = "https://script.google.com/macros/s/AKfycbxCgq1JLHx3gfVcYVXCpZ3xel5Sfv6vTldJBQG8qP6Xx-XLLMihaGE1Uf4hE7Y7mYXF/exec" # GANTI DENGAN URL WEB APP ANDA
$hostname = $env:COMPUTERNAME

# --- GET HARDWARE INFO ---
$cpu = (Get-WmiObject Win32_Processor).Name | Out-String
$ram = [math]::Round((Get-WmiObject Win32_OperatingSystem).TotalVisibleMemorySize / 1MB, 2)

$cDrive = Get-WmiObject Win32_LogicalDisk | Where-Object { $_.DeviceID -eq "C:" }
$freeGB = [math]::Round($cDrive.FreeSpace / 1GB, 2)
$percentFree = [math]::Round(($cDrive.FreeSpace / $cDrive.Size) * 100, 2)

# --- GET NETWORK INFO (ACTIVE ADAPTER Preferred) ---
# Picking the IP associated with the default gateway to avoid 169.254.x.x (APIPA)
$activeRoute = Get-NetRoute -DestinationPrefix 0.0.0.0/0 | Sort-Object RouteMetric | Select-Object -First 1
if ($activeRoute) {
    $activeNet = Get-NetIPAddress -InterfaceIndex $activeRoute.InterfaceIndex -AddressFamily IPv4 | Select-Object -First 1
    $ipAddress = $activeNet.IPAddress
    $macAdapter = Get-NetAdapter -InterfaceIndex $activeRoute.InterfaceIndex
    $macAddress = $macAdapter.MacAddress
} else {
    # Fallback if no gateway found (e.g. local lab network without internet)
    $activeNet = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "169.254.*" -and $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1
    $ipAddress = if ($activeNet) { $activeNet.IPAddress } else { "N/A" }
    $macAdapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1
    $macAddress = if ($macAdapter) { $macAdapter.MacAddress } else { "N/A" }
}
# --- CHECK PENDING REBOOT (Windows Update & Others) ---
$isRebootPending = $false
$regPaths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending"
)
foreach ($path in $regPaths) { if (Test-Path $path) { $isRebootPending = $true } }

$alerts = @()
if ($isRebootPending) { $alerts += "Reboot Required" }
if ($percentFree -lt 13) { $alerts += "Low Disk: $percentFree%" }

$workStatus = if ($alerts.Count -gt 0) { "Active (" + ($alerts -join ", ") + ")" } else { "Active" }

# --- GET USER PROFILES (From C:\Users, excluding system/public) ---
$profiles = (Get-ChildItem -Path C:\Users -Directory | Where-Object { $_.Name -notmatch "Public|Default|All Users" }).Name -join ", "

# --- PREPARE PAYLOAD ---
$payload = @{
    path       = "record-activity"
    hostname   = $hostname
    ipAddress  = $ipAddress
    macAddress = $macAddress
    cpu        = $cpu.Trim()
    ram        = "$ram GB"
    disk       = "$freeGB GB Free ($percentFree%)"
    users      = $profiles
    workStatus = $workStatus
} | ConvertTo-Json

# --- SEND HEARTBEAT ---
try {
    Write-Host "Mengirim heartbeat untuk $hostname (IP: $ipAddress)..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri $gasUrl -Method Post -Body $payload -ContentType "application/json"
    if ($response.success) {
        Write-Host "Heartbeat Terkirim! Status: OK" -ForegroundColor Green
    } else {
        Write-Host "Gagal: $($response.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
