# ==========================================
# LAB MANAGEMENT LOGIC - CENTRALIZED
# ==========================================

$gasUrl = "https://script.google.com/macros/s/AKfycbxCgq1JLHx3gfVcYVXCpZ3xel5Sfv6vTldJBQG8qP6Xx-XLLMihaGE1Uf4hE7Y7mYXF/exec"
$hostname = $env:COMPUTERNAME

# 1. Deteksi "Real Work" (File Save/Modify)
# Menggunakan [Environment] agar kompatibel dengan OneDrive/Folder Redirection
$docPath = [Environment]::GetFolderPath('MyDocuments')
$desktopPath = [Environment]::GetFolderPath('Desktop')
$recentFiles = Get-ChildItem -Path $docPath, $desktopPath -Recurse -File -ErrorAction SilentlyContinue | 
               Where-Object { $_.LastWriteTime -gt (Get-Date).AddHours(-1) }
$hasWork = $recentFiles.Count -gt 0
# 2. Deteksi Software Aktif (Heavy Lifting)
$heavyApps = @("matlab", "autocad", "python", "ansys", "sap2000")
$activeApp = Get-Process | Where-Object { $heavyApps -contains $_.ProcessName.ToLower() -and $_.CPU -gt 5 }
$isProcessing = $null -ne $activeApp
# 3. Collect Inventory
$inventory = @{
    path      = "record-activity"
    hostname  = $hostname
    cpu       = (Get-CimInstance Win32_Processor).Name
    ram       = "$([Math]::Round((Get-CimInstance Win32_PhysicalMemory | Measure-Object Capacity -Sum).Sum / 1GB)) GB"
    disk      = "$([Math]::Round((Get-PSDrive C).Free / 1GB)) GB Free"
    users     = (Get-ChildItem C:\Users -Directory | Where-Object { $_.Name -notmatch "Public|Default" }).Name -join ", "
    workStatus = if ($hasWork -or $isProcessing) { "Active" } else { "Idle" }
}
# 4. Send to GAS (Hanya jika jam kerja atau berkala)
Invoke-RestMethod -Uri $gasUrl -Method Post -Body ($inventory | ConvertTo-Json) -ContentType "application/json"
