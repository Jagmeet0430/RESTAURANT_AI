param(
  [string]$TaskName = "RestaurantAI Admin Client"
)

$ErrorActionPreference = "Stop"

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Admin client autostart task removed: $TaskName"
} else {
  Write-Host "Admin client autostart task not present: $TaskName"
}
