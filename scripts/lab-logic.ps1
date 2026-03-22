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
$disk = [math]::Round((Get-WmiObject Win32_LogicalDisk | Where-Object { $_.DeviceID -eq "C:" }).FreeSpace / 1GB, 2)

# --- GET NETWORK INFO (ACTIVE ADAPTER) ---
$activeNet = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1
$ipAddress = if ($activeNet) { $activeNet.IPAddress } else { "N/A" }

$macAdapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1
$macAddress = if ($macAdapter) { $macAdapter.MacAddress } else { "N/A" }

# --- GET LOGGED IN USERS ---
$users = (Get-WmiObject Win32_LoggedOnUser | Select-Object -Unique Anticedent).Anticedent.Name -join ", "

# --- PREPARE PAYLOAD ---
$payload = @{
    path       = "record-activity"
    hostname   = $hostname
    ipAddress  = $ipAddress
    macAddress = $macAddress
    cpu        = $cpu.Trim()
    ram        = "$ram GB"
    disk       = "$disk GB Free"
    users      = $users
    workStatus = "Active"
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
