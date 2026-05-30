Param(
    [switch]$DryRun
)

$services = @('uptime-kuma','backend','cadvisor','prometheus','frontend','grafana')
$rand = Get-Random -Minimum 0 -Maximum $services.Count
$choice = $services[$rand]
Write-Host "Selected service: $choice"

$containers = docker ps --format '{{.ID}} {{.Names}}' | Select-String -Pattern $choice
if (-not $containers) {
    Write-Host "No running container matching '$choice' found."
    exit 1
}

# Take the first match
$line = ($containers[0].ToString()).Trim()
$cid = $line.Split(' ')[0]
Write-Host "Found container: $line"
if ($DryRun) {
    Write-Host "Dry run: would stop $cid"
    exit 0
}

Write-Host "Stopping container $cid"
docker stop $cid
Write-Host "Stopped $cid"
