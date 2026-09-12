param(
  [string]$TaskName = "RestaurantAI Server and Customer Kiosk"
)

$ErrorActionPreference = "Stop"

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Kiosk autostart task removed: $TaskName"
} else {
  Write-Host "Kiosk autostart task not present: $TaskName"
}
